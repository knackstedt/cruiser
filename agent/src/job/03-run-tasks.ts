import { context, Span, trace } from '@opentelemetry/api';

import { orderSort } from '../util/order-sort';
import { PipelineJobDefinition, PipelineDefinition, PipelineInstance, PipelineStage, PipelineTaskGroup, PipelineTask } from '../types/pipeline';
import { api } from '../util/axios';
import { CreateLoggerSocketServer } from '../socket/logger';
import { JobInstance } from '../types/agent-task';

import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import { exists, mkdir, mkdirp } from 'fs-extra';

import { TripBreakpoint } from '../socket/breakpoint';
import { ulid } from 'ulidx';
import { environment } from '../util/environment';
import path from 'path';
import { TaskDefinition } from '../types/task-definition';

const tracer = trace.getTracer('agent-task-runner');

const decoder = new TextDecoder();
let _gid = 100;

const getEnv = async (
    span: Span,
    pipeline: PipelineDefinition,
    stage: PipelineStage,
    job: PipelineJobDefinition,
    taskGroup: PipelineTaskGroup,
    task: PipelineTask,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>,
    gid,
    tgid
) => {
    const execEnv = {};

    Object.entries(global.process.env)
        // Omit variables that we don't want the underlying program to
        // have to deal with
        .filter(e => !e[0].startsWith("CI_"))
        .filter(e => !e[0].startsWith("CRUISER_"))
        .filter(e => !e[0].startsWith("KUBERNETES_"))
        .forEach(e => execEnv[e[0]] = e[1]);

    // TODO: Parse variables out of command? Will we decide against this?
    // Object.entries(env)

    const roots = [pipeline, stage, job, taskGroup, task];

    const secretRequests: Promise<{ key: string, value: string; }>[] = [];

    // Collect all of the environment variables defined on each level
    for (let i = 0; i < roots.length; i++) {
        const envList = roots[i].environment ?? [];

        for (let j = 0; j < envList.length; j++) {
            const envItem = envList[j] ?? {} as any;

            // If the variable is a secret, we'll request that.
            if (envItem.isSecret) {
                secretRequests.push(api.get(span, `/api/${roots[i].id}/${envItem.value}`)
                    .then(res => ({ key: envItem.name, value: res.data } as any))
                    .catch(err => {
                        logger.error({
                            msg: `Failed to load secret \`${envItem.key}\``,
                            properties: {
                                stack: err.stack,
                                msg: err.message,
                                gid, tgid
                            }
                        });
                        return { key: envItem.name, value: null, err };
                    }));

                continue;
            }
            else {
                execEnv[envItem.name] = envItem.value;
            }
        }
    }

    // Resolve all of the secret requests. This allows
    // them to be fetched in parallel.
    for await (const secret of secretRequests) {
        execEnv[secret.key] = secret.value;
    }

    return execEnv;
}

const executeTaskGroup = async (
    parentSpan: Span,
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: PipelineStage,
    job: PipelineJobDefinition,
    jobInstance: JobInstance,
    taskGroup: PipelineTaskGroup,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>,
    gid: number
) => tracer.startActiveSpan(
    "TaskGroup",
    undefined,
    trace.setSpan(context.active(), parentSpan),
    async span => {
    const tgid = taskGroup.id;



    try {
        logger.info({
            msg: `Initiating TaskGroup \`${taskGroup.label}\``,
            properties: {
                taskGroup,
                gid,
                tgid
            },
            block: "start"
        });

        const tasks = taskGroup.tasks.sort(orderSort) ?? [];

        // TODO: Implement and endpoint to return environment variables?
        // const { data: envVars } =
        //     await api.get<{ key: string, value: string; }[]>(span, `/api/jobs/${jobInstance.id}/environment`);
        const envVars = {};

        let breakOnNextTask = false;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            // Skip disabled tasks
            if (task.disabled) continue;

            const env = {};
            Object.assign(envVars, env);

            const correlationId = ulid();

            let retry = false;
            do {
                retry = false;

                const ctx = trace.setSpan(context.active(), parentSpan);
                await tracer.startActiveSpan("Task", undefined, ctx, async span => {
                    // TODO: Force task cwd to start with /build for a security purpose?
                    const processCWD = task.cwd?.startsWith("/")
                        ? path.resolve(task.cwd)
                        : path.resolve(environment.buildDir, (task.cwd ?? ''));

                    span.setAttributes({
                        "taskGroup.id": taskGroup.id,
                        "task.id": task.id,
                        "task.cwd": processCWD
                    });

                    if (breakOnNextTask) {
                        breakOnNextTask = (await TripBreakpoint(span, jobInstance, false, false, taskGroup, task)) == 2;
                    }
                    if (task.breakBeforeTask) {
                        logger.info({ msg: `⏸ Tripping on PreExecute Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
                        await TripBreakpoint(span, jobInstance, false, false, taskGroup, task, correlationId);
                        logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
                    }

                    // Try to create the CWD.
                    await mkdirp(processCWD);

                    const env = await getEnv(
                        span,
                        pipeline,
                        stage,
                        job,
                        taskGroup,
                        task,
                        logger,
                        gid,
                        tgid
                    );

                    const runProcess = (
                        command: string,
                        args: string[],
                        environment?: NodeJS.ProcessEnv
                    ) => {
                        return new Promise<{
                            stdout: string,
                            stderr: string,
                            exitCode: number
                        }>(async (res, rej) => {
                            try {


                                logger.info({
                                    msg: `Spawning process \`${command}\` for task \`${task.label}\` in group \`${taskGroup.label}\``,
                                    properties: { processCWD, command, args, env, taskGroup, task, gid, tgid }
                                });

                                const ctx = trace.setSpan(context.active(), span);
                                await tracer.startActiveSpan("Process", undefined, ctx, async span => {
                                    span.setAttributes({
                                        "process.command": command,
                                        "process.arguments": args,
                                        "process.timeout": task.timeout || 0
                                    });

                                    const environmentVars = {};
                                    Object.assign(env, environment);
                                    Object.assign(environmentVars, environment);

                                    const process = spawn(command, args, {
                                        env: environmentVars,
                                        cwd: processCWD,
                                        timeout: task.timeout || 0,
                                        windowsHide: true
                                    });


                                    let stdout = '';
                                    let stderr = '';

                                    process.stdout.on('data', (data) => {
                                        const textData = decoder.decode(data);
                                        stdout += textData
                                        logger.stdout({ time: Date.now(), level: "stdout", chunk: textData, properties: { task: task.id, gid, tgid } })
                                    });
                                    process.stderr.on('data', (data) => {
                                        const textData = decoder.decode(data);
                                        stderr += textData
                                        logger.stderr({ time: Date.now(), level: "stderr", chunk: textData, properties: { task: task.id, gid, tgid } })
                                    });

                                    process.on('error', (err) => {
                                        span.setAttributes({ "process.exitCode": -2 });
                                        logger.error({
                                            msg: "Process error",
                                            properties: {
                                                stack: err.stack,
                                                msg: err.message,
                                                gid, tgid
                                            }
                                        });
                                        // Do I need to set exit code?
                                        res({
                                            stdout,
                                            stderr,
                                            exitCode: process.exitCode
                                        });
                                    });

                                    process.on('disconnect', (...args) => {
                                        span.setAttributes({ "process.exitCode": -1 });
                                        logger.error({
                                            msg: `Process \`${command}\` unexpectedly disconnected`,
                                            properties: { args, taskGroup, task, gid, tgid }
                                        });
                                        res({
                                            stdout,
                                            stderr,
                                            exitCode: process.exitCode
                                        });
                                    });

                                    process.on('exit', (exitCode) => {
                                        span.setAttributes({ "process.exitCode": exitCode });
                                        if (exitCode == 0) {
                                            logger.info({ msg: `Process \`${command}\` exited successfully`, properties: { taskGroup, task, gid, tgid } });
                                            span.end();
                                            res({
                                                stdout,
                                                stderr,
                                                exitCode: process.exitCode
                                            });
                                        }
                                        else {
                                            logger.error({ msg: `Process \`${command}\` exited with non-zero exit code \`${exitCode}\``, properties: { code: exitCode, taskGroup, task, gid, tgid } });
                                            span.end();
                                            res({
                                                stdout,
                                                stderr,
                                                exitCode: process.exitCode
                                            });
                                        }
                                    });
                                });
                            }
                            catch (err) {
                                // Return the process and transmit the error object
                                res({
                                    exitCode: -1,
                                    err: err
                                } as any);
                            }
                        });
                    }

                    const { data: taskDefinition } = await api.get<TaskDefinition>(span, `/api/odata/task-definition/${task.kind}`);

                    if (!taskDefinition) {
                        if (task.breakOnTaskFailure) {
                            logger.info({ msg: `⏸ Breaking on error: task definition does not exist`, properties: { taskGroup, task, gid, tgid, correlationId } });
                            const breakpointResult = await TripBreakpoint(span, jobInstance, true, true, taskGroup, task, correlationId);
                            retry = breakpointResult == 1;
                            breakOnNextTask = breakpointResult == 2;
                            logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
                        }
                        else {
                            logger.fatal({ msg: `Task Failed! Task type is unknown!`, properties: { taskGroup, task, gid, tgid } });
                        }

                        span.end();
                        return;
                    }

                    // Run the script, get the result code.
                    const code = await taskDefinition.script({
                        axios: null,
                        emitEvent: (event) => { },
                        logger: logger,
                        setProgress: val => { },
                        runProcess: runProcess,
                        tripBreakpoint: (label, message, allowRetry) =>
                            TripBreakpoint(span, jobInstance, allowRetry, true, taskGroup, task, correlationId),
                        config: {},
                        environment: {}
                    })


                    if (code == 0) {

                        if (task.breakOnTaskSuccess) {
                            logger.info({ msg: `⏸ Tripping on Success Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
                            const breakpointResult = await TripBreakpoint(span, jobInstance, true, true, taskGroup, task, correlationId);
                            retry = breakpointResult == 1;
                            breakOnNextTask = breakpointResult == 2;
                            logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
                        }
                    }

                    // TODO: Should this property be carried up to the pipeline?
                    if (code != 0 && task.breakOnTaskFailure) {
                        logger.info({ msg: `⏸ Breaking on error`, properties: { taskGroup, task, gid, tgid, correlationId } });
                        const breakpointResult = await TripBreakpoint(span, jobInstance, true, true, taskGroup, task, correlationId);
                        retry = breakpointResult == 1;
                        breakOnNextTask = breakpointResult == 2;
                        logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
                    }

                    if (task.breakAfterTask) {
                        logger.info({ msg: `⏸ Tripping on PostExecute Breakpoint`, properties: { taskGroup, task, gid, tgid, correlationId } });
                        const breakpointResult = await TripBreakpoint(span, jobInstance, true, true, taskGroup, task, correlationId);
                        retry = breakpointResult == 1;
                        breakOnNextTask = breakpointResult == 2;
                        logger.info({ msg: `▶ Resuming from Breakpoint`, properties: { taskGroup, task, gid, tgid } });
                    }

                    span.end();
                });
            }
            while (retry)
        }

        logger.info({
            msg: `Completed TaskGroup \`${taskGroup.label}\``,
            properties: {
                taskGroup,
                gid,
                tgid
            },
            block: "end"
        });
    }
    catch (ex) {
        logger.error({
            msg: ex.message || "Unhandled error",
            properties: {
                stack: ex.stack,
                error: ex.message,
                name: ex.name,
                gid,
                tgid
            }
        });
    }
    span.end();
});

export const RunTasks = (
    parentSpan: Span,
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: PipelineStage,
    job: PipelineJobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => tracer.startActiveSpan(
    "Tasks",
    undefined,
    trace.setSpan(context.active(), parentSpan),
    async span => {

    job.taskGroups?.sort(orderSort);

    const completedMap: { [key: string]: PipelineTaskGroup } = {};

    const taskGroupIdList = job.taskGroups.map(tg => tg.id);

    // immediately invoke all task groups with no preGroups
    const immediateTaskGroups = job.taskGroups
        .filter(tg => !tg.preTaskGroups || tg.preTaskGroups.length == 0);
    const triggeredTaskGroups = job.taskGroups
        .filter(tg =>
            tg.preTaskGroups?.length > 0 &&
            tg.preTaskGroups.every(tgi => taskGroupIdList.includes(tgi as any))
        );

    // All taskGroups that have a missing preGroup. Will warn the user that they cannot possibly be
    // executed.
    const impossibleTaskGroups = job.taskGroups
        // immediately invoke all task groups with no preGroups
        .filter(tg =>
            !immediateTaskGroups.includes(tg) &&
            !triggeredTaskGroups.includes(tg)
        );

    // All task groups that cannot possibly be run will print in a console error.
    if (impossibleTaskGroups.length > 0) {
        logger.warn({
            msg: "Job has " + impossibleTaskGroups.length + " task groups that cannot possibly execute due to missing dependencies!",
            properties: {
                orphanedTaskGroups: impossibleTaskGroups
            }
        });
    }

    // "Recursive" to trigger all of the taskGroups that
    const runTaskGroups = (taskGroups: PipelineTaskGroup[]) => {
        const gid = _gid++;
        logger.info({
            msg: "Starting series of TaskGroups",
            block: "start",
            properties: {
                parallelBlock: true,
                taskGroups,
                gid
            }
        })

        return Promise.all(
            taskGroups.map(async taskGroup => {

                if (!taskGroup.disabled) {
                    await executeTaskGroup(span, pipelineInstance, pipeline, stage, job, jobInstance, taskGroup, logger, gid);
                }

                completedMap[taskGroup.id] = taskGroup;

                const nextTgList = triggeredTaskGroups.filter(ttg =>
                    ttg.preTaskGroups.every(ptgi => completedMap[ptgi])
                );
                // Remove the just-run task group from the list
                nextTgList.forEach(tg =>
                    triggeredTaskGroups.splice(triggeredTaskGroups.indexOf(tg), 1)
                );

                if (nextTgList.length > 0) {
                    await runTaskGroups(nextTgList);
                }
            })
        ).then(res => {
            logger.info({
                msg: "Ended series of TaskGroups",
                block: "end",
                properties: {
                    parallelBlock: false,
                    taskGroups,
                    gid
                }
            });

            return res;
        })
    };

    const res = await runTaskGroups(immediateTaskGroups);
    span.end();
    return res;
});
