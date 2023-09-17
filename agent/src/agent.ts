import Surreal from 'surrealdb.js';
import execa from 'execa';
import { JobInstance } from '../types/agent-task';
import { Pipeline, PipelineJob, PipelineTaskGroup } from '../types/pipeline';
import { getLogger, orderSort, sleep } from './util/util';
import { ResolveSources } from './source-resolver';

const logger = getLogger("agent");


const freezePollInterval = 5000;

const validateJobCanRun = async (job: PipelineJob) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");

}

async function freezeTaskProcessing(db: Surreal, { taskGroup, agentTask }: { taskGroup: PipelineTaskGroup, agentTask: JobInstance; }) {

    let [freezePoint] = await db.create(`taskFreezePoints:ulid()`, {
        taskGroup: taskGroup.id,
        jobInstance: agentTask.id
    });

    while (true) {
        await sleep(freezePollInterval);

        [freezePoint] = await db.select(freezePoint.id) as any;

        // If the freeze point has been removed, resume the pipeline
        if (!freezePoint) break;
    }
}

const RunTaskGroupsInParallel = (db: Surreal, taskGroups: PipelineTaskGroup[], jobInstance) => {
    taskGroups?.sort(orderSort);

    return Promise.all(taskGroups.map(taskGroup => new Promise(async (r) => {

        const tasks = taskGroup.tasks.sort(orderSort);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            const env = {};
            const environment: { key: string, value: string; }[] =
                await db.query(`RETURN fn::task_get_environment(${task.id})`) as any;

            environment.forEach(({ key, value }) => env[key] = value);

            if (task.freezeBeforeRun) {
                logger.info(`Encountered freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
                await freezeTaskProcessing(db, { taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
            }

            logger.info(`Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);

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
                await freezeTaskProcessing(db, { taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);
            }
        }

        await sleep(1);
        r(0)
    })));
}

export const Agent = async (taskId: string, db: Surreal) => {

    const jobInstance: JobInstance = (await db.query(`SELECT * FROM ${taskId} FETCH pipeline, job, job.taskGroups, job.taskGroups.tasks`))?.[0]?.result?.[0] as any;
    const pipeline = jobInstance?.pipeline;
    const job = jobInstance?.job;

    if (!jobInstance) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        // process.exit(1);
        return;
    }

    if (!pipeline || !job) {
        const message = `Job does not have reference to [${!!pipeline ? 'pipeline' : ''}${!!job ? !!pipeline ? ', job' : 'job' : ''}]`;

        logger.fatal({ msg: message });
        await db.merge(taskId, { state: "failed", failReason: message });
        // process.exit(1)
        return;
    }


    // Perform preflight checks
    logger.info({ state: "Initializing", msg: "Begin initializing" });
    await db.merge(taskId, { state: "initializing" });
    await validateJobCanRun(job);
    logger.info({ state: "Initializing", msg: "Agent initialize completed" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning" });
    await db.merge(taskId, { state: "cloning" });
    await ResolveSources(pipeline, job);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building" });
    await db.merge(taskId, { state: "building" });
    await RunTaskGroupsInParallel(db, job.taskGroups, jobInstance);
    logger.info({ state: "Building", msg: "Agent build completed" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing" });
    await db.merge(taskId, { state: "sealing" });
    logger.info({ state: "Sealing", msg: "Agent sealing completed" });

    // TODO: compress and upload artifacts
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));

    logger.info({ state: "finished", msg: "Agent has completed it's work." });
    await db.merge(taskId, { state: "finished" });
}
