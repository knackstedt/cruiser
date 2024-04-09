import { orderSort } from './util/order-sort';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition, TaskGroupDefinition } from './types/pipeline';
import { api } from './util/axios';
import { getSocketLogger } from './socket/logger';
import { RunProcess } from './util/process-manager';
import { JobInstance } from './types/agent-task';

const executeTaskGroup = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    taskGroup: TaskGroupDefinition,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    try {
        logger.info({
            msg: `Initiating TaskGroup ${taskGroup.label}`,
            taskGroup,
            block: "start"
        });

        const tasks = taskGroup.tasks.sort(orderSort);

        const envVars: { key: string, value: string; }[] =
            await api.get(`/api/jobs/${jobInstance.id}/environment`);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            // Skip disabled tasks
            if (task.disabled) continue;

            logger.info({
                msg: `Initiating task ${task.label}`,
                task,
                block: "start"
            });

            const env = {};
            Object.assign(envVars, env);

            await RunProcess(
                pipelineInstance,
                pipeline,
                stage,
                job,
                taskGroup,
                task,
                jobInstance,
                logger
            );
        }

        logger.info({
            msg: `Completed TaskGroup ${taskGroup.label}`,
            taskGroup,
            block: "end"
        });
    }
    catch (ex) {
        logger.error({
            msg: "Unhandled error",
            stack: ex.stack,
            error: ex.message,
            name: ex.name
        });
    }
}

export const RunTaskGroups = (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    job.taskGroups?.sort(orderSort);

    const completedMap: { [key: string]: TaskGroupDefinition } = {};

    const taskGroupIdList = job.taskGroups.map(tg => tg.id);

    // immediately invoke all task groups with no preGroups
    const immediateTaskGroups = job.taskGroups
        .filter(tg => !tg.preTaskGroups || tg.preTaskGroups.length == 0);
    const triggeredTaskGroups = job.taskGroups
        .filter(tg =>
            tg.preTaskGroups.length > 0 &&
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
            msg: "Job has " + impossibleTaskGroups.length + " task groups that cannot possibly execute due to missing dependency task groups!",
            taskGroups: impossibleTaskGroups
        });
    }

    // Recursive
    const runTaskGroups = (taskGroups: TaskGroupDefinition[]) => Promise.all(
        taskGroups.map(taskGroup => new Promise(async (r) => {

            if (!taskGroup.disabled) {
                await executeTaskGroup(pipelineInstance, pipeline, stage, job, jobInstance, taskGroup, logger);
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

            r(0);
        }))
    );


    return runTaskGroups(immediateTaskGroups);
};
