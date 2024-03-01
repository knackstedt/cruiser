import { spawn } from 'child_process';
import { JobInstance } from '../types/agent-task';
import { ResolveSources } from './util/source-resolver';
import environment from './util/environment';
import { JobDefinition, TaskGroupDefinition } from '../types/pipeline';
import { getSocketLogger } from './socket/logger';
import { api } from './util/axios';
import { sleep } from './util/sleep';
import { orderSort } from './util/order-sort';
import { envSubstitute } from './util/envsubst';


const freezePollInterval = parseInt(process.env['DOTOPS_FREEZE_POLL_INTERVAL'] || '5000');

const validateJobCanRun = async (job: JobDefinition) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");
};

async function freezeTaskProcessing({ taskGroup, agentTask }: { taskGroup: TaskGroupDefinition, agentTask: JobInstance; }) {

    await api.patch(`/api/odata/job:${environment.agentId}`, {
        status: "frozen"
    });

    // Keep running until we break out or throw an exception
    // Should this occur indefinitely, the containing job will
    // expire.
    while (true) {
        await sleep(freezePollInterval);

        const { data } = await api.get(`/api/odata/job:${environment.agentId}`);

        // If the freeze point has been removed, resume the pipeline
        if (!data || data.state != "frozen") break;
    }
}

export const RunAgentProcess = async (taskId: string) => {

    const logger = await getSocketLogger();

    let res = await api.get(`/api/odata/${taskId}`);
    let kubeTask = res.data;

    if (typeof kubeTask == "string") {
        logger.fatal({msg: "Axios failed to parse json", res})
        kubeTask = JSON.parse(kubeTask);
    }
    const pipeline = kubeTask?.pipeline;
    const job      = kubeTask?.job;

    if (!kubeTask) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        return;
    }

    if (!pipeline || !job) {
        if (!pipeline)
            logger.fatal({ msg: `Job does not have reference to Pipeline`, jobInstance: kubeTask });
        if (!job)
            logger.fatal({ msg: `Job does not have reference to Job`, jobInstance: kubeTask });

        await api.patch(`/api/odata/${taskId}`, { state: "failed" })
        return;
    }

    logger.emit("$metadata", {
        pipeline,
        job
    });

    const RunTaskGroupsInParallel = (taskGroups: TaskGroupDefinition[], jobInstance) => {
        taskGroups?.sort(orderSort);

        return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {
            try {
                logger.info({
                    msg: `Initiating TaskGroup ${taskGroup.label}`,
                    taskGroup
                });

                const tasks = taskGroup.tasks.sort(orderSort);

                const environment: { key: string, value: string; }[] =
                    await api.get(`/api/jobs/${jobInstance.id}/environment`);

                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];

                    logger.info({
                        msg: `Initiating task ${task.label}`,
                        task
                    });

                    const env = {};
                    Object.assign(environment, env);

                    if (task.freezeBeforeRun) {
                        logger.info({
                            msg: `Encountered freeze marker in task group ${taskGroup.label} before task ${task.label}`,
                        });
                        await freezeTaskProcessing({ taskGroup, agentTask: jobInstance });
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

                        process.stdout.on('data', (data) => logger.emit("log:stdout", { data }));
                        process.stderr.on('data', (data) => logger.emit("log:stderr", { data }));

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
                        process
                    });

                    if (task.freezeAfterRun) {
                        logger.info({
                            msg: `Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`

                        });
                        await freezeTaskProcessing({ taskGroup, agentTask: jobInstance });
                        logger.info({
                            msg: `Unfroze freeze marker in task group ${taskGroup.label} after task ${task.label}`
                        });
                    }
                }
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
    logger.info({ state: "Initializing", msg: "Begin initializing" });
    await api.patch(`/api/odata/${taskId}`, { state: "initializing" })
    await validateJobCanRun(job);
    logger.info({ state: "Initializing", msg: "Agent initialize completed" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning" });
    await api.patch(`/api/odata/${taskId}`, { state: "cloning" })
    await ResolveSources(pipeline, job);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building" });
    await api.patch(`/api/odata/${taskId}`, { state: "building" })
    await RunTaskGroupsInParallel(job.taskGroups, kubeTask);
    logger.info({ state: "Building", msg: "Agent build completed" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing" });
    await api.patch(`/api/odata/${taskId}`, { state: "sealing" })
    // TODO: compress and upload artifacts
    // (format? progress?)
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));
    logger.info({ state: "Sealing", msg: "Agent sealing completed" });


    logger.info({ state: "finished", msg: "Agent has completed it's work." });
    await api.patch(`/api/odata/${taskId}`, { state: "finished" });
}
