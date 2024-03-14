
import { sleep } from './util/sleep';
import { orderSort } from './util/order-sort';
import { TaskGroupDefinition } from '../types/pipeline';
import { api } from './util/axios';
import { getSocketLogger } from './socket/logger';
import { RunProcess } from './util/process-manager';
import { JobInstance } from '../types/agent-task';

export const RunTaskGroupsInParallel = (
    taskGroups: TaskGroupDefinition[],
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    taskGroups?.sort(orderSort);

    return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {
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

                logger.info({
                    msg: `Initiating task ${task.label}`,
                    task,
                    block: "start"
                });

                const env = {};
                Object.assign(envVars, env);

                await RunProcess(jobInstance, task, logger);
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

        await sleep(1);
        r(0);
    })));
};
