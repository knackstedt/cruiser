import { Socket, io } from "socket.io-client";
import {environment} from '../util/environment';
import { getLogger } from '../util/logger';
import { JobDefinition, PipelineDefinition } from '../types/pipeline';
import { DefaultEventsMap } from '@socket.io/component-emitter';
import { api } from '../util/axios';
import { JobInstance } from '../types/agent-task';

const logger = getLogger("agent");
const showDebug = !!process.env['AGENT_WEBSOCKETS_VERBOSE'];

export const getSocket = async (pipeline: PipelineDefinition, jobInstance: JobInstance) => {
    let socket: Socket;

    try {
        socket = io(environment.cruiserUrl, {
            path: "/ws/socket-tunnel-internal",
            extraHeaders: {
                "X-Cruiser-Token": environment.cruiserToken
            }
        });

        logger.info("Connecting to socket...");

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
                logger.info("Socket connected");
                res(socket);
            });
            socket.on("disconnect", () => {
                logger.warn("Socket lost connection to cluster");
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
                await api.patch(`/api/odata/${environment.jobInstanceId}`, {
                    state: "cancelled",
                    endEpoch: Date.now()
                });

                logger.warn({
                    msg: "Task cancelled by user. Shutting down..."
                });

                // 5ms to allow anything necessary to flush
                setTimeout(() => {
                    process.exit(0);
                }, 5)
            });

            socket.on("error", (err) => {
                logger.error(err);
                rej(err)
            });
            socket.connect();
        });
    }
    catch (ex) {
        logger.error(ex);
    }

    return socket;
};
