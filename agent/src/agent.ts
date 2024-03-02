import { spawn } from 'child_process';
import { ResolveSources } from './util/source-resolver';
import { JobDefinition, PipelineDefinition, TaskGroupDefinition } from '../types/pipeline';
import { getSocketLogger } from './socket/logger';
import { api } from './util/axios';
import { sleep } from './util/sleep';
import { orderSort } from './util/order-sort';
import { envSubstitute } from './util/envsubst';
import { getConfig } from './util/config';
import { TripBreakpoint } from './util/breakpoint';


const validateJobCanRun = async (job: JobDefinition) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");
};


export const RunAgentProcess = async (taskId: string) => {

    const logger = await getSocketLogger();
    const { job, pipeline, kubeTask } = await getConfig(taskId, logger);


    const RunTaskGroupsInParallel = (taskGroups: TaskGroupDefinition[], jobInstance) => {
        taskGroups?.sort(orderSort);

        return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {
            try {
                logger.info({
                    msg: `Initiating TaskGroup ${taskGroup.label}`,
                    taskGroup,
                    block: "start"
                });
                logger.socket.emit("log:block-start", { time: Date.now(), data: { taskGroup }, msg: `TaskGroup ${taskGroup.label}` })

                const tasks = taskGroup.tasks.sort(orderSort);

                const environment: { key: string, value: string; }[] =
                    await api.get(`/api/jobs/${jobInstance.id}/environment`);

                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];

                    logger.info({
                        msg: `Initiating task ${task.label}`,
                        task,
                        block: "start"
                    });
                    logger.socket.emit("log:block-start", { time: Date.now(), data: { taskGroup, task }, msg: `Task ${task.label}` })

                    const env = {};
                    Object.assign(environment, env);

                    if (task.freezeBeforeRun) {
                        logger.info({
                            msg: `Encountered freeze marker in task group ${taskGroup.label} before task ${task.label}`,
                        });
                        await TripBreakpoint({ taskGroup, agentTask: jobInstance });
                        logger.info({
                            msg: `Unfroze freeze marker in task group ${taskGroup.label} before task ${task.label}`,
                        });
                    }

                    const command = envSubstitute(task.command);
                    const args = task.arguments.map(a => envSubstitute(a));

                    const process = await new Promise((res, rej) => {
                        logger.info({
                            msg: `spawning process ${task.label}`,
                            command,
                            args,
                            task
                        });

                        const process = spawn(command, args, {
                            env: env,
                            cwd: task.workingDirectory,
                            timeout: task.commandTimeout || 0,
                            windowsHide: true
                        });

                        process.stdout.on('data', (data) => logger.socket.emit("log:stdout", { time: Date.now(), data }));
                        process.stderr.on('data', (data) => logger.socket.emit("log:stderr", { time: Date.now(), data }));

                        process.on('error', (err) => logger.error(err));

                        process.on('disconnect', (...args) => {
                            logger.error({
                                msg: `Child process for Task ${task.label} in group ${taskGroup.label} disconnected!`,
                                args
                            });
                            res(process);
                        });

                        process.on('exit', (code) => {
                            if (code == 0) {
                                logger.info({
                                    msg: `Task ${task.label} in group ${taskGroup.label} successfully completed`
                                });
                                res(process);
                            }
                            else {
                                logger.error({
                                    msg: `Task ${task.label} in group ${taskGroup.label} exited with non-zero exit code`,
                                    code
                                });
                                res(process);
                            }
                        });
                    });

                    logger.info({
                        msg: `Completed task ${task.label}`,
                        process,
                        block: "end"
                    });
                    logger.socket.emit("log:block-end", { time: Date.now(), data: { taskGroup, task }, msg: `Task ${task.label} completed` })

                    if (task.freezeAfterRun) {
                        logger.info({
                            msg: `Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`

                        });
                        await TripBreakpoint({ taskGroup, agentTask: jobInstance });
                        logger.info({
                            msg: `Unfroze freeze marker in task group ${taskGroup.label} after task ${task.label}`
                        });
                    }
                }

                logger.info({
                    msg: `Completed TaskGroup ${taskGroup.label}`,
                    taskGroup,
                    block: "end"
                });
                logger.socket.emit("log:block-end", { time: Date.now(), data: { taskGroup }, msg: `TaskGroup ${taskGroup.label} completed` })
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
    }

    // Perform preflight checks
    logger.info({ state: "Initializing", msg: "Begin initializing", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "initializing" })
    await validateJobCanRun(job);
    logger.info({ state: "Initializing", msg: "Agent initialize completed", block: "end" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "cloning" })
    await ResolveSources(pipeline, job);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed", block: "end" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "building" })
    await RunTaskGroupsInParallel(job.taskGroups, kubeTask);
    logger.info({ state: "Building", msg: "Agent build completed", block: "end" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "sealing" })
    // TODO: compress and upload artifacts
    // (format? progress?)
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));
    logger.info({ state: "Sealing", msg: "Agent sealing completed", block: "end" });


    logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
    await api.patch(`/api/odata/${taskId}`, { state: "finished" });
}
