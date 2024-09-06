import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import { exists, mkdir } from 'fs-extra';
import {environment} from './environment';

import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition, TaskDefinition, TaskGroupDefinition } from '../types/pipeline';
import { CreateLoggerSocketServer } from '../socket/logger';
import { JobInstance } from '../types/agent-task';
import { TripBreakpoint } from '../socket/breakpoint';
import { ParseCommand } from './command-parser';
import { api } from './axios';

export const RunProcess = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    taskGroup: TaskGroupDefinition,
    task: TaskDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    let retry = false;
    do {
        retry = false;


        if (task.breakBeforeTask) {
            logger.info({ msg: `⏸ Tripping on Breakpoint`, breakpoint: true, taskGroup, task });
            await TripBreakpoint(jobInstance, false, taskGroup, task);
            logger.info({ msg: `Resuming from Breakpoint`, breakpoint: false, taskGroup, task });
        }

        const processCWD = task.cwd?.startsWith("/")
            ? task.cwd
            : environment.buildDir + (task.cwd ?? '');

        // Try to create the CWD.
        if (!await exists(processCWD))
            await mkdir(processCWD, { recursive: true });

        const process: ChildProcessWithoutNullStreams = await new Promise<ChildProcessWithoutNullStreams>(async(res, rej) => {
            try {
                // TODO: join env separately.
                // const specifiedCommand = task.taskScriptArguments['command'];


                const {
                    command,
                    args,
                    env
                } = ParseCommand(task.taskScriptArguments['command'] + ' ' + task.taskScriptArguments['arguments']);

                const execEnv = {};

                Object.entries(global.process.env)
                    // Omit some variables that we don't want the underlying program to
                    // have to deal with
                    .filter(e => !e[0].startsWith("CI_"))
                    .filter(e => !e[0].startsWith("CRUISER_"))
                    .filter(e => !e[0].startsWith("KUBERNETES_"))
                    .forEach(e => execEnv[e[0]] = e[1]);

                // TODO: Parse variables out of command? Will we decide against this?
                // Object.entries(env)

                const roots = [ pipeline, stage, job, taskGroup, task ];

                const secretRequests: Promise<{key: string, value: string}>[] = [];

                // Collect all of the environment variables defined on each level
                for (let i = 0; i < roots.length; i++) {
                    const envList = roots[i].environment ?? [];

                    for (let j = 0; j < envList.length; j++) {
                        const envItem = envList[j] ?? {} as any;

                        // If the variable is a secret, we'll request that.
                        if (envItem.isSecret) {
                            secretRequests.push(api.get(`/api/${roots[i].id}/${envItem.value}`)
                                .then(res => ({ key: envItem.name, value: res.data }))
                                .catch(err => {
                                    logger.error({
                                        msg: `Failed to load secret '${envItem.key}'`,
                                        err
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

                logger.info({
                    msg: `Spawning process '${command}' for task '${task.label}' in group '${taskGroup.label}'`,
                    processCWD,
                    command,
                    args,
                    execEnv,
                    taskGroup,
                    task
                });

                const process = spawn(command, args, {
                    env: execEnv,
                    cwd: processCWD,
                    timeout: task.timeout || 0,
                    windowsHide: true
                });

                process.stdout.on('data', (data) => logger.stdout({ time: Date.now(), data, taskGroup, task }));
                process.stderr.on('data', (data) => logger.stderr({ time: Date.now(), data, taskGroup, task }));

                process.on('error', (err) => {
                    logger.error({
                        msg: "Process error",
                        err
                    })
                });

                process.on('disconnect', (...args) => {
                    logger.error({
                        msg: `Process '${command}' unexpectedly disconnected`,
                        args,
                        taskGroup,
                        task
                    });
                    res(process);
                });

                process.on('exit', (code) => {
                    if (code == 0) {
                        logger.info({ msg: `Process '${command}' exited successfully`, taskGroup, task });
                        res(process);
                    }
                    else {
                        logger.error({ msg: `Process '${command}' exited with non-zero exit code (${code})`, code, taskGroup, task });
                        res(process);
                    }
                });
            }
            catch(err) {
                // Return the process and transmit the error object
                res({
                    exitCode: -1,
                    err: err
                } as any);
            }
        });

        if (process?.exitCode == 0) {
            logger.info({
                msg: `Completed task '${task.label}' in group '${taskGroup.label}'`,
                process,
                taskGroup,
                task,
                block: "end"
            });

            if (task.breakOnTaskSuccess) {
                logger.info({ msg: `⏸ Tripping on Breakpoint`, breakpoint: true, taskGroup, task });
                retry = await TripBreakpoint(jobInstance, true, taskGroup, task);
                logger.info({ msg: `▶ Resuming from Breakpoint`, breakpoint: false, taskGroup, task });
            }
        }
        else {
            // logger.error({
            //     msg: process.exitCode == -1 ? "Failed to spawn process" : `Process exited with non-zero code (${process.exitCode})`,
            //     ...(process.exitCode == -1 ? { err: process['err'] } : { process })
            // });

            if (task.breakOnTaskFailure) {
                logger.info({ msg: `⏸ Breaking on error`, breakpoint: true, error: true, taskGroup, task });
                retry = await TripBreakpoint(jobInstance, true, taskGroup, task);
                logger.info({ msg: `▶ Resuming from Breakpoint`, breakpoint: true, error: false, taskGroup, task });
            }
        }

        if (task.breakAfterTask) {
            logger.info({ msg: `⏸ Tripping on Breakpoint`, breakpoint: true, taskGroup, task });
            retry = await TripBreakpoint(jobInstance, true, taskGroup, task);
            logger.info({ msg: `▶ Resuming from Breakpoint`, breakpoint: false, taskGroup, task });
        }
    }
    while(retry)
}
