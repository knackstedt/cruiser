import { ResolveSources } from './util/source-resolver';
import { api } from './util/axios';
import { getConfig } from './util/config';
import { getSocketLogger } from './socket/logger';
import { getSocketTerminal } from './socket/terminal';
import { getSocket } from './socket/socket';
import { RunTaskGroupsInParallel } from './run-tasks';
import { BindSocketBreakpoint, TripBreakpoint } from './socket/breakpoint';
import { validateJobCanRun } from './util/job-validator';
import { UploadArtifacts } from './util/artifact-uploader';
import { PreflightCheck } from './util/preflight-check';

export const RunAgentProcess = async (jobInstanceId: string) => {
    const { pipelineInstance, pipeline, stage, job, kubeTask, jobInstance } = await getConfig(jobInstanceId);

    const socket = await getSocket(pipeline, job);
    const logger = await getSocketLogger(socket);
    const terminal = await getSocketTerminal(socket);
    await BindSocketBreakpoint(socket, logger);


    // Perform preflight checks
    logger.info({ state: "Preflight", msg: "Running preflight check" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "preflight", initEpoch: Date.now() })
    await PreflightCheck();
    logger.info({ state: "Preflight", msg: "Preflight check finished" });

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
    await UploadArtifacts(
        pipelineInstance,
        pipeline,
        stage,
        job,
        kubeTask,
        logger
    );
    await TripBreakpoint(jobInstance, false);
    logger.info({ state: "Sealing", msg: "Agent sealing completed", block: "end" });


    logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
    await api.patch(`/api/odata/${jobInstanceId}`, { state: "finished", endEpoch: Date.now() });
}
