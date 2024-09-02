import { GetInputs } from './job/02-get-inputs';
import { api } from './util/axios';
import { getConfig } from './util/config';
import { CreateLoggerSocketServer } from './socket/logger';
import { CreateTerminalSocketServer } from './socket/terminal';
import { CreateBaseSocketServer } from './socket/socket';
import { RunTasks } from './job/03-run-tasks';
import { CreateBreakpointSocketServer, TripBreakpoint } from './socket/breakpoint';
import { UploadArtifacts } from './job/04-upload-artifacts';
import { PreflightCheck } from './job/01-preflight-check';
import { exists, mkdir } from 'fs-extra';
import { environment } from './util/environment';
import { CreateMetricsSocketServer } from './socket/metrics';

export const RunAgentProcess = async (jobInstanceId: string) => {
    if (!await exists(environment.buildDir))
        await mkdir(environment.buildDir, { recursive: true });

    const { pipelineInstance, pipeline, stage, job, jobInstance } = await getConfig(jobInstanceId);

    /**
     * Create socket "servers" that will provide information to clients
     */
    const socket = await CreateBaseSocketServer(pipeline, jobInstance);
    const logger = await CreateLoggerSocketServer(socket);
    const terminal = await CreateTerminalSocketServer(socket, logger);
    const breakpoint = await CreateBreakpointSocketServer(socket, jobInstance, logger);
    const metrics = await CreateMetricsSocketServer(socket);

    try {
        logger.info({
            msg: "Agent started",
            pipelineInstance,
            pipeline,
            stage,
            job,
            jobInstance
        });

        // Perform preflight checks
        logger.info({ state: "preflight", msg: "Running preflight check" });
        await api.patch(`/api/odata/${jobInstanceId}`, { state: "preflight", initEpoch: Date.now() })
        await PreflightCheck();
        logger.info({ state: "preflight", msg: "Preflight check finished" });

        // logger.info({ state: "initializing", msg: "Begin initializing" });
        // await api.patch(`/api/odata/${jobInstanceId}`, { state: "initializing", initEpoch: Date.now() })
        // await validateJobCanRun(job, logger);
        // logger.info({ state: "initializing", msg: "Agent initialize completed" });

        // Download sources
        logger.info({ state: "cloning", msg: "Agent source cloning", block: "start" });
        await api.patch(`/api/odata/${jobInstanceId}`, { state: "cloning", cloneEpoch: Date.now() })
        await GetInputs(pipelineInstance, pipeline, stage, job, jobInstance, logger);
        logger.info({ state: "cloning", msg: "Agent source cloning completed", block: "end" });

        // Follow job steps to build code
        logger.info({ state: "building", msg: "Agent building", block: "start" });
        await api.patch(`/api/odata/${jobInstanceId}`, { state: "building", buildEpoch: Date.now() })
        await RunTasks(
            pipelineInstance,
            pipeline,
            stage,
            job,
            jobInstance,
            logger
        );
        logger.info({ state: "building", msg: "Agent build completed", block: "end" });

        // Seal (compress) artifacts
        logger.info({ state: "sealing", msg: "Agent sealing", block: "start" });
        await api.patch(`/api/odata/${jobInstanceId}`, { state: "sealing", uploadEpoch: Date.now() })
        await UploadArtifacts(
            pipelineInstance,
            pipeline,
            stage,
            job,
            jobInstance,
            logger
        );
        logger.info({ state: "sealing", msg: "Agent sealing completed", block: "end" });


        logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
        await api.patch(`/api/odata/${jobInstanceId}`, { state: "finished", endEpoch: Date.now() });
    }
    catch(err) {
        logger.fatal({
            msg: "⏸ Cannot continue build task!",
            stack: err.stack,
            message: err.message ?? err.title ?? err.name
        })
        await TripBreakpoint(jobInstance, false);
    }
}
