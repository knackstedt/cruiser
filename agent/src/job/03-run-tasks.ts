import { context, Span, trace } from '@opentelemetry/api';

import { orderSort } from '../util/order-sort';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition, TaskGroupDefinition } from '../types/pipeline';
import { api } from '../util/axios';
import { CreateLoggerSocketServer } from '../socket/logger';
import { RunProcess } from '../util/process-manager';
import { JobInstance } from '../types/agent-task';

const tracer = trace.getTracer('agent-task-runner');

let _gid = 100;

const executeTaskGroup = async (
    parentSpan: Span,
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    taskGroup: TaskGroupDefinition,
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

        const { data: envVars } =
            await api.get<{ key: string, value: string; }[]>(span, `/api/jobs/${jobInstance.id}/environment`);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            // Skip disabled tasks
            if (task.disabled) continue;

            // logger.info({
            //     msg: `Initiating task '${task.label}' in group '${taskGroup.label}'`,
            //     properties: {
            //         task,
            //     },
            //     block: "start"
            // });

            const env = {};
            Object.assign(envVars, env);

            await RunProcess(
                span,
                pipelineInstance,
                pipeline,
                stage,
                job,
                taskGroup,
                task,
                jobInstance,
                logger,
                gid,
                tgid
            );
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
            msg: "Unhandled error",
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
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => tracer.startActiveSpan(
    "Tasks",
    undefined,
    trace.setSpan(context.active(), parentSpan),
    async span => {

    job.taskGroups?.sort(orderSort);

    const completedMap: { [key: string]: TaskGroupDefinition } = {};

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
    const runTaskGroups = (taskGroups: TaskGroupDefinition[]) => {
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
