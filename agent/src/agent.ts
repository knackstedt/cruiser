import execa from 'execa';
import { JobInstance } from '../types/agent-task';
import { PipelineJob, PipelineTaskGroup } from '../types/pipeline';
import { getLogger, orderSort, sleep } from './util/util';
import { ResolveSources } from './source-resolver';
import { api } from './util';
import environment from './environment';

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

        const tasks = taskGroup.tasks.sort(orderSort);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            const env = {};

            const environment: { key: string, value: string; }[] =
                await api.get(`/api/job/${task.id}/environment`);
                // await db.query(`RETURN fn::task_get_environment(${task.id})`) as any;

            environment.forEach(({ key, value }) => env[key] = value);

            if (task.freezeBeforeRun) {
                logger.info(`Encountered freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
                await freezeTaskProcessing({ taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
            }

            await execa(task.command, task.arguments, {
                env: env,
                cwd: task.workingDirectory,
                timeout: task.commandTimeout || 0
            }).then(res => {
                logger.info(`Task ${task.label} in group ${taskGroup.label} successfully completed`, res);
            })
            .catch(err => {
                logger.error(`Task ${task.label} in group ${taskGroup.label} failed`, err);
            });

            if (task.freezeAfterRun) {
                logger.info(`Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);
                await freezeTaskProcessing({ taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);
            }
        }

        await sleep(1);
        r(0)
    })));
}

export const RunAgentProcess = async (taskId: string) => {

    const jobInstance: JobInstance = await api.get(`/api/odata/${taskId}`);
    const pipeline = jobInstance?.pipeline;
    const job      = jobInstance?.job;

    if (!jobInstance) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        // process.exit(1);
        return;
    }

    if (!pipeline || !job) {
        const message = `Job does not have reference to [${!!pipeline ? 'pipeline' : ''}${!!job ? !!pipeline ? ', job' : 'job' : ''}]`;

        logger.fatal({ msg: message });
        await api.patch(`/api/odata/${taskId}`, { state: "failed", failReason: message })
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
    await RunTaskGroupsInParallel(job.taskGroups, jobInstance);
    logger.info({ state: "Building", msg: "Agent build completed" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing" });
    await api.patch(`/api/odata/${taskId}`, { state: "sealing" })
    logger.info({ state: "Sealing", msg: "Agent sealing completed" });

    // TODO: compress and upload artifacts
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));

    logger.info({ state: "finished", msg: "Agent has completed it's work." });
    await api.patch(`/api/odata/${taskId}`, { state: "finished" })
}
