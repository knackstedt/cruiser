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

        // Don't store non-log messages
        if (ev.startsWith("log:"))
            history.push({ ev, data });
        return null;
    };

    socket.on("log:get-history", () =>
        // For each record stored in history, emit it to the client.
        // We emit it to the original emitter, so the records don't
        // duplicate.
        originalEmit("log:history", history)
    );

    const decoder = new TextDecoder();

    // Create a wrapper for the logger
    // such that all log records can be replayed
    // Also emit all entries to stdout so that when the pod
    // terminates, we can write the log to disk then subsequently
    // read it to rebuild the entire log result
    return {
        debug: (obj: Object) => {
            obj['data'] = { time: Date.now(), level: "debug", ...obj };
            obj['ev'] = "log:agent";
            logger.debug(obj);
            socket.emit(obj['ev'], obj['data']);
        },
        info: (obj: Object) => {
            obj['data'] = { time: Date.now(), level: "info", ...obj };
            obj['ev'] = "log:agent";
            logger.info(obj);
            socket.emit(obj['ev'], obj['data']);
        },
        warn: (obj: Object) => {
            obj['data'] = { time: Date.now(), level: "warn", ...obj };
            obj['ev'] = "log:agent";
            logger.warn(obj);
            socket.emit(obj['ev'], obj['data']);
        },
        error: (obj: Object) => {
            obj['data'] = { time: Date.now(), level: "error", ...obj };
            obj['ev'] = "log:agent";
            logger.error(obj);
            socket.emit(obj['ev'], obj['data']);
        },
        fatal: (obj: Object) => {
            obj['data'] = { time: Date.now(), level: "fatal", ...obj };
            obj['ev'] = "log:agent";
            logger.fatal(obj);
            socket.emit(obj['ev'], obj['data']);
        },
        stdout: (obj: Object) => {
            const t = Date.now();
            socket.emit("log:stdout", { time: t, data: obj['data'] });

            const output = decoder.decode(obj['data']).trim();
            output.split('\n')
                .forEach(line =>
                    process.stdout.write(`log:stdout ${t};${line}\n`)
                )
        },
        stderr: (obj: Object) => {
            const t = Date.now();
            socket.emit("log:stderr", { time: t, data: obj['data'] });

            const output = decoder.decode(obj['data']).trim();
            output.split('\n')
                .forEach(line =>
                    process.stdout.write(`log:stderr ${t};${line}\n`)
                )
        }
    };
}
