import { JobInstance } from '../types/agent-task';
import { PipelineJob, PipelineTaskGroup } from '../types/pipeline';
import { getLogger, orderSort, sleep } from './util/util';
import { ResolveSources } from './source-resolver';
import { api, envSubstitute } from './util';
import environment from './environment';
import { spawn } from 'child_process';

const logger = getLogger("agent");


const freezePollInterval = 5000;

const validateJobCanRun = async (job: PipelineJob) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");
}

async function freezeTaskProcessing({ taskGroup, agentTask }: { taskGroup: PipelineTaskGroup, agentTask: JobInstance; }) {

    await api.patch(`/api/odata/job:${environment.agentId}`, {
        status: "frozen"
    });

    // Keep running until we break out or throw an exception
    // Should this occur indefinitely, the containing job will
    // expire.
    while (true) {
        await sleep(freezePollInterval);

        const {data} = await api.get(`/api/odata/job:${environment.agentId}`);

        // If the freeze point has been removed, resume the pipeline
        if (!data || data.state != "frozen") break;
    }
}

const RunTaskGroupsInParallel = (taskGroups: PipelineTaskGroup[], jobInstance) => {
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

                    process.stdout.on('data', (data) => {
                        logger.info({
                            task,
                            stdout: data.toString()
                        });
                    });

                    process.stderr.on('data', (data) => {
                        logger.warn({
                            task,
                            stdout: data.toString()
                        });
                    });

                    process.on('error', (err) => {
                        logger.error(err);
                    });

                    process.on('disconnect', (...args) => {
                        logger.error({
                            msg: `Child process for Task ${task.label} in group ${taskGroup.label} disconnected!`,
                            args
                        });
                    });

                    process.on('exit', (code) => {
                        if (code == 0) {
                            logger.info(`Task ${task.label} in group ${taskGroup.label} successfully completed`, res);
                            res(process);
                        }
                        else {
                            logger.error({
                                msg: `Task ${task.label} in group ${taskGroup.label} exited with non-zero exit code`,
                                code
                            });
                            res(process)
                        }
                    });

                })

                logger.info({
                    msg: `Completed task ${task.label}`,
                    process
                });

                // await execa(task.command, task.arguments, {
                //     env: env,
                //     cwd: task.workingDirectory,
                //     timeout: task.commandTimeout || 0
                // }).then(res => {
                //     logger.info(`Task ${task.label} in group ${taskGroup.label} successfully completed`, res);
                // })
                // .catch(err => {
                //     logger.error(`Task ${task.label} in group ${taskGroup.label} failed`, err);
                // });

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
        catch(ex) {
            logger.error({
                msg: "Unhandled error",
                stack: ex.stack,
                error: ex.message,
                name: ex.name
            })
        }

        await sleep(1);
        r(0)
    })));
}

export const RunAgentProcess = async (taskId: string) => {

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
        // process.exit(1);
        return;
    }

    if (!pipeline || !job) {
        if (!pipeline)
            logger.fatal({ msg: `Job does not have reference to Pipeline`, jobInstance: kubeTask });
        if (!job)
            logger.fatal({ msg: `Job does not have reference to Job`, jobInstance: kubeTask });

        await api.patch(`/api/odata/${taskId}`, { state: "failed" })
        // process.exit(1)
        return;
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
    await api.patch(`/api/odata/${taskId}`, { state: "finished" })
}
