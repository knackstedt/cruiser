import { Socket, io } from "socket.io-client";
import environment from '../util/environment';
import { getLogger } from '../util/logger';

const pinoLogger = getLogger("agent");

export const getSocketLogger = async () => {
    let socket: Socket;
    let enableSocket = false;
    try {

        socket = io(environment.dotopsUrl, {
            path: "/ws/socket-tunnel-internal",
            // extraHeaders: {}
        });

        const history: {
            ev: string,
            data: Object
        }[] = [];

        const originalEmit = socket.emit.bind(socket);
        socket.emit = (ev: string, data: Object) => {
            originalEmit(ev, data);
            history.push({ ev, data });
            return null;
        };

        pinoLogger.info("We will await a socket connection");
        socket.onAny(pinoLogger.info);
        await new Promise((res, rej) => {
            try {
                socket.on("connect", () => {
                    pinoLogger.info("Connected to cluster");
                    enableSocket = true;
                    res(socket)
                });
                socket.on("disconnect", () => {
                    pinoLogger.info("Lost connection to cluster");
                    enableSocket = false;
                });
                socket.on("log:get-history", () =>
                    // For each record stored in history, emit it to the client.
                    // We emit it to the original emitter, so the records don't
                    // duplicate.
                    history.forEach(({ ev, data }) => originalEmit(ev, data))
                );
                socket.on("error", (err) => console.error(err));
                socket.connect();
            }
            catch(ex) {
                debugger;
            }
        });
    }
    catch(ex) {
        pinoLogger.error(ex);
    }

    // Create a wrapper for the logger
    // such that all log records can be replayed
    return {
        debug: (obj: Object) => {
            pinoLogger.debug(obj);
            enableSocket && socket.emit("log:agent", { time: Date.now(), level: "debug", ...obj });
        },
        info: (obj: Object) => {
            pinoLogger.info(obj);
            enableSocket && socket.emit("log:agent", { time: Date.now(), level: "info", ...obj });
        },
        warn: (obj: Object) => {
            pinoLogger.warn(obj);
            enableSocket && socket.emit("log:agent", { time: Date.now(), level: "warn", ...obj });
        },
        error: (obj: Object) => {
            pinoLogger.error(obj);
            enableSocket && socket.emit("log:agent", { time: Date.now(), level: "error", ...obj });
        },
        fatal: (obj: Object) => {
            pinoLogger.fatal(obj);
            enableSocket && socket.emit("log:agent", { time: Date.now(), level: "fatal", ...obj });
        },
        socket: socket
    };
}
