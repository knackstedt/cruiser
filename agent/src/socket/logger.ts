import { io } from "socket.io-client";
import environment from '../util/environment';
import { getLogger } from '../util/logger';

const pinoLogger = getLogger("agent");

export const getSocketLogger = async () => {
    const socket = io(environment.dotopsUrl, {
        path: "/ws/log-ingest",
        extraHeaders: {}
    });

    const history = [];
    const originalEmit = socket.emit;
    socket.emit = (ev: string, data: Object) => {
        originalEmit(ev, data);
        history.push({ ev, data });
        return null;
    };

    await new Promise((res, rej) => {
        socket.on("connection", (socket) => res(socket));
        socket.on("log:get-history", () =>
            // For each record stored in history, emit it to the client.
            // We emit it to the original emitter, so the records don't
            // duplicate.
            history.forEach(({ ev, data }) => originalEmit(ev, data))
        );
        socket.on("error", (err) => rej(err));
    });

    // Create a wrapper for the logger
    // such that all log records can be replayed
    return {
        debug: (obj: Object) => {
            pinoLogger.debug(obj);
            socket.emit("log:agent", { time: Date.now(), level: "debug", ...obj });
        },
        info: (obj: Object) => {
            pinoLogger.info(obj);
            socket.emit("log:agent", { time: Date.now(), level: "info", ...obj });
        },
        warn: (obj: Object) => {
            pinoLogger.warn(obj);
            socket.emit("log:agent", { time: Date.now(), level: "warn", ...obj });
        },
        error: (obj: Object) => {
            pinoLogger.error(obj);
            socket.emit("log:agent", { time: Date.now(), level: "error", ...obj });
        },
        fatal: (obj: Object) => {
            pinoLogger.fatal(obj);
            socket.emit("log:agent", { time: Date.now(), level: "fatal", ...obj });
        },
        emit: socket.emit
    };
}
