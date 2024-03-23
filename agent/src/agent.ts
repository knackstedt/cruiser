import { ResolveSources } from './util/source-resolver';
import { api } from './util/axios';
import { getConfig } from './util/config';
import { getSocketLogger } from './socket/logger';
import { getSocketTerminal } from './socket/terminal';
import { getSocket } from './socket/socket';
import { RunTaskGroupsInParallel } from './run-tasks';
import { BindSocketBreakpoint } from './socket/breakpoint';
import { validateJobCanRun } from './util/job-validator';

export const RunAgentProcess = async (jobInstanceId: string) => {
    const { pipelineInstance, pipeline, stage, job, kubeTask, jobInstance } = await getConfig(jobInstanceId);

    const socket = await getSocket(pipeline, job);
    const logger = await getSocketLogger(socket);
    const terminal = await getSocketTerminal(socket);
    await BindSocketBreakpoint(socket);


    // Perform preflight checks
    logger.info({ state: "Initializing", msg: "Begin initializing" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "initializing", initEpoch: Date.now() })
    await validateJobCanRun(job, logger);
    logger.info({ state: "Initializing", msg: "Agent initialize completed" });

    // Download sources
    logger.info({ state: "Cloning", msg: "Agent source cloning", block: "start" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "cloning", cloneEpoch: Date.now() })
    await ResolveSources(pipeline, jobInstance, logger);
    logger.info({ state: "Cloning", msg: "Agent source cloning completed", block: "end" });

    // Follow job steps to build code
    logger.info({ state: "Building", msg: "Agent building", block: "start" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "building", buildEpoch: Date.now() })
    await RunTaskGroupsInParallel(
        pipelineInstance,
        pipeline,
        stage,
        job,
        kubeTask,
        logger
    );
    logger.info({ state: "Building", msg: "Agent build completed", block: "end" });

    // Seal (compress) artifacts
    logger.info({ state: "Sealing", msg: "Agent sealing", block: "start" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "sealing", uploadEpoch: Date.now() })
    // TODO: compress and upload artifacts
    // (format? progress?)
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));
    logger.info({ state: "Sealing", msg: "Agent sealing completed", block: "end" });


    logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "finished", endEpoch: Date.now() });
}
