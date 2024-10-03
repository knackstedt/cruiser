import { Socket, io } from "socket.io-client";
import {environment} from '../util/environment';
import { JobDefinition, PipelineDefinition } from '../types/pipeline';
import { DefaultEventsMap } from '@socket.io/component-emitter';
import { api } from '../util/axios';
import { JobInstance } from '../types/agent-task';
import { Span } from '@opentelemetry/api';
import { OpenTelemetry } from '../util/instrumentation';
import { logger } from '../util/logger';
const showDebug = !!process.env['AGENT_WEBSOCKETS_VERBOSE'];

export const CreateBaseSocketServer = async (parentSpan: Span, pipeline: PipelineDefinition, jobInstance: JobInstance) => {
    let socket: Socket;

    try {
        socket = io(environment.cruiserUrl, {
            path: "/socket/socket-tunnel-internal",
            auth: {
                "X-Cruiser-Token": environment.cruiserToken
            },
            extraHeaders: {
                "X-Cruiser-Token": environment.cruiserToken
            }
        });

        if (showDebug) {
            socket.onAny((msg, ...args) => {
                console.log("\x1b[36m --> " + msg +"\x1b[0m " + args.length);
            });
            const emit = socket.emit.bind(socket);
            socket.emit = ((msg, ...args) => {
                console.log("\x1b[32m <-- " + msg + "\x1b[0m " + args.length);
                return emit(msg, ...args);
            })
        }

        return new Promise<Socket<DefaultEventsMap, DefaultEventsMap>>((res, rej) => {
            socket.on("connect", () => {
                // logger.info({ msg: "Agent connected" })
                res(socket);
            });
            socket.on("connect_error", (err) => {
                logger.error({ msg: `Agent connection failed: ${err.message}`, properties: { stack: err.stack } });
                rej(err);
            });
            socket.on("disconnect", () => {
                logger.warn({ msg: "Agent lost connection to cluster!" })
            });
            // During the connect handshake, we need to tell the server
            // what this job is
            socket.on("$get-metadata", () => {
                socket.emit("$metadata", {
                    pipeline,
                    jobInstance
                });
            });

            // If we get a cancel event, we'll stop the agent.
            socket.on("$stop-job", async () => {
                await api.patch(parentSpan, `/api/odata/${environment.jobInstanceId}`, {
                    state: "cancelled",
                    endEpoch: Date.now()
                });

                logger.warn({ msg: "Job being shut down preemptively by cluster. Shutting down." })

                // 5ms to allow anything necessary to flush
                setTimeout(async () => {
                    await OpenTelemetry?.exporter?.shutdown();
                    process.exit(0);
                }, 5)
            });

            socket.on("error", (err) => {
                logger.warn({ msg: err.message, properties: { stack: err.stack } })
                rej(err);
            });
            socket.connect();
        });
    }
    catch (ex) {
        logger.warn({ msg: ex.message, properties: { stack: ex.stack } })
    }

    return socket;
};
