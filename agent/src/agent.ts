import { ResolveSources } from './util/source-resolver';
import { api } from './util/axios';
import { getConfig } from './util/config';
import { getSocketLogger } from './socket/logger';
import { getSocketTerminal } from './socket/terminal';
import { getSocket } from './socket/socket';
import { RunTaskGroupsInParallel } from './run-tasks';
import { JobDefinition } from '../types/pipeline';


const validateJobCanRun = async (job: JobDefinition) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");
};


export const RunAgentProcess = async (taskId: string) => {
    const { job, pipeline, kubeTask, jobInstance } = await getConfig(taskId);

    const socket = await getSocket(pipeline, job)
    const logger = await getSocketLogger(socket);
    const terminal = await getSocketTerminal(socket);



    // Perform preflight checks
    logger.info({ state: "Initializing", msg: "Begin initializing" });
    await api.patch(`/api/odata/${taskId}`, { state: "initializing", initEpoch: Date.now() })
    await validateJobCanRun(job);
    logger.info({ state: "Initializing", msg: "Agent initialize completed" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "cloning", cloneEpoch: Date.now() })
    await ResolveSources(pipeline, jobInstance, logger);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed", block: "end" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "building", buildEpoch: Date.now() })
    await RunTaskGroupsInParallel(job.taskGroups, kubeTask, logger);
    logger.info({ state: "Building", msg: "Agent build completed", block: "end" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing", block: "start" });
    await api.patch(`/api/odata/${taskId}`, { state: "sealing", uploadEpoch: Date.now() })
    // TODO: compress and upload artifacts
    // (format? progress?)
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));
    logger.info({ state: "Sealing", msg: "Agent sealing completed", block: "end" });


    logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
    await api.patch(`/api/odata/${taskId}`, { state: "finished", endEpoch: Date.now() });
}
