import { trace } from '@opentelemetry/api';
import { getHeapStatistics } from 'v8';

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
import { CreateMetricsSocketServer } from './socket/metrics';

const tracer = trace.getTracer('agent');

export const RunAgentProcess = async (jobInstanceId: string) => {

    return tracer.startActiveSpan("Build", async span => {

        const { pipelineInstance, pipeline, stage, job, jobInstance } = await getConfig(span, jobInstanceId);

        /**
         * Create socket "servers" that will connect to the cruiser server
         */
        const socket = await CreateBaseSocketServer(span, pipeline, jobInstance);
        const logger = await CreateLoggerSocketServer(span, socket);
        const terminal = await CreateTerminalSocketServer(span, socket);
        const breakpoint = await CreateBreakpointSocketServer(socket, jobInstance);
        const metrics = await CreateMetricsSocketServer(span, socket);


        try {
            const heapStats = getHeapStatistics();
            const toGb = (stat) => {
                if (stat > 1024 ** 3)
                    return (stat / 1024 ** 3).toFixed(2) + "GB";
                if (stat > 1024 ** 2)
                    return (stat / 1024 ** 2).toFixed(2) + "MB";
                if (stat > 1024)
                    return (stat / 1024).toFixed(2) + "KB";
                return stat + "B";
            };

            logger.info({
                msg: "Agent starting",
                block: "start",
                properties: {
                    cwd: process.cwd(),
                    ...Object.entries(heapStats).map(([k, v]) => ({
                        [k]: toGb(v)
                    })).reduce((a, b) => ({ ...a, ...b }), {}),
                    pipelineInstance,
                    pipeline,
                    stage,
                    job,
                    jobInstance
                }
            });

            // Perform preflight checks
            logger.info({ state: "preflight", msg: "Running preflight check", block: "start" });
            await api.patch(span, `/api/odata/${jobInstanceId}`, { state: "preflight", initEpoch: Date.now() })
            await PreflightCheck(span);
            logger.info({ state: "preflight", msg: "Preflight check finished", block: "end" });

            // Download sources
            logger.info({ state: "cloning", msg: "Agent source cloning", block: "start" });
            await api.patch(span, `/api/odata/${jobInstanceId}`, { state: "cloning", cloneEpoch: Date.now() })
            await GetInputs(span, pipelineInstance, pipeline, stage, job, jobInstance, logger);
            logger.info({ state: "cloning", msg: "Agent source cloning completed", block: "end" });

            // Follow job steps to build code
            logger.info({ state: "building", msg: "Agent building", block: "start" });
            await api.patch(span, `/api/odata/${jobInstanceId}`, { state: "building", buildEpoch: Date.now() })
            await RunTasks(
                span,
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
            await api.patch(span, `/api/odata/${jobInstanceId}`, { state: "sealing", uploadEpoch: Date.now() })
            await UploadArtifacts(
                span,
                pipelineInstance,
                pipeline,
                stage,
                job,
                jobInstance,
                logger
            );
            logger.info({ state: "sealing", msg: "Agent sealing completed", block: "end" });


            logger.info({ state: "finished", msg: "Agent has completed it's work.", block: "end" });
            await api.patch(span, `/api/odata/${jobInstanceId}`, { state: "finished", endEpoch: Date.now() });
        }
        catch(err) {
            logger.fatal({
                msg: "⏸ Cannot continue build task: " + err.message,
                properties: {
                    stack: err.stack,
                    msg: err.message
                }
            })
            await TripBreakpoint(span, jobInstance, false, false);
        }
        span.end();
    })
}
