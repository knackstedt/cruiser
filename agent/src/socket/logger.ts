import { Socket, io } from "socket.io-client";
import { getLogger } from '../util/logger';

const logger = getLogger("agent");

export const getSocketLogger = async(socket: Socket) => {
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

    socket.on("log:get-history", () =>
        // For each record stored in history, emit it to the client.
        // We emit it to the original emitter, so the records don't
        // duplicate.
        originalEmit("log:history", history)
    );

    // Create a wrapper for the logger
    // such that all log records can be replayed
    return {
        debug: (obj: Object) => {
            logger.debug(obj);
            socket.emit("log:agent", { time: Date.now(), level: "debug", ...obj });
        },
        info: (obj: Object) => {
            logger.info(obj);
            socket.emit("log:agent", { time: Date.now(), level: "info", ...obj });
        },
        warn: (obj: Object) => {
            logger.warn(obj);
            socket.emit("log:agent", { time: Date.now(), level: "warn", ...obj });
        },
        error: (obj: Object) => {
            logger.error(obj);
            socket.emit("log:agent", { time: Date.now(), level: "error", ...obj });
        },
        fatal: (obj: Object) => {
            logger.fatal(obj);
            socket.emit("log:agent", { time: Date.now(), level: "fatal", ...obj });
        },
        socket: socket
    };
}
