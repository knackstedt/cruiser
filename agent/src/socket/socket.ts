import { Socket, io } from "socket.io-client";
import environment from '../util/environment';
import { getLogger } from '../util/logger';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';

const logger = getLogger("agent");
const showDebug = !!process.env['AGENT_WEBSOCKETS_VERBOSE'];

export const getSocket = async (pipeline: PipelineDefinition, job: JobDefinition) => {
    let socket: Socket;

    try {
        socket = io(environment.dotopsUrl, {
            path: "/ws/socket-tunnel-internal",
            // extraHeaders: {}
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

        await new Promise((res, rej) => {
            socket.on("connect", () => {
                logger.info("Socket connected");
                res(socket);
            });
            socket.on("disconnect", () => {
                logger.warn("Socket lost connection to cluster");
            });
            socket.on("$get-metadata", () => {
                socket.emit("$metadata", {
                    pipeline,
                    job
                });
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
