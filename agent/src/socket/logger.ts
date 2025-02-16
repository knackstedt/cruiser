import { Socket, io } from "socket.io-client";
import { logger } from '../util/logger';
import { Span } from '@opentelemetry/api';
import { LogRecord } from '../types/agent-log';
import { environment } from '../util/environment';

export const CreateLoggerSocketServer = async (parentSpan: Span, socket: Socket) => {
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

    // For each record stored in history, emit it to the server.
    // We emit it to the original emitter, so the records don't
    // duplicate.
    socket.on("connect", () => {
        originalEmit("log:history-populate", history.map(h => h.data))
    });

    let stdout = '';
    let stderr = '';

    // Create a wrapper for the logger
    // such that all log records can be replayed
    // Also emit all entries to stdout so that when the pod
    // terminates, we can write the log to disk then subsequently
    // read it to rebuild the entire log result
    return {
        debug: (obj: Omit<LogRecord, 'level' | 'time'>) => {
            const object = {
                time: Date.now(),
                level: "debug",
                ...obj
            };

            logger.info(object as LogRecord);
            // console.log(object);
            socket.emit("log:agent", object);
        },
        info: (obj: Omit<LogRecord, 'level' | 'time'>) => {
            const object = {
                time: Date.now(),
                level: "info",
                ...obj
            };

            logger.info(object as LogRecord);
            socket.emit("log:agent", object);
        },
        warn: (obj: Omit<LogRecord, 'level' | 'time'>) => {
            const object = {
                time: Date.now(),
                level: "warn",
                ...obj
            };

            logger.warn(object as LogRecord);
            socket.emit("log:agent", object);        },
        error: (obj: Omit<LogRecord, 'level' | 'time'>) => {
            const object = {
                time: Date.now(),
                level: "error",
                ...obj
            };

            logger.error(object as LogRecord);
            socket.emit("log:agent", object);
        },
        fatal: (obj: Omit<LogRecord, 'level' | 'time'>) => {
            const object = {
                time: Date.now(),
                level: "fatal",
                ...obj
            };

            logger.fatal(object as LogRecord);
            socket.emit("log:agent", object);
        },
        stdout: (obj: LogRecord) => {
            stdout += obj['chunk'] as any;

            const charIndex = stdout.lastIndexOf('\n');
            const t = Date.now();
            if (charIndex != -1) {
                // If we have enough input for a chunk, flush it out to clients
                const readyText = stdout.slice(0, charIndex);
                stdout = stdout.slice(charIndex);

                const lines = readyText.split('\n');
                socket.emit("log:stdout", { time: t, level: "stdout", chunk: lines, properties: obj.properties });

                // Write all entries to stdout
                lines.forEach(line =>
                    line != '' && process.stdout.write(`>1:${obj.properties['gid']}:${obj.properties['tgid']}:${t};${line}\n`)
                )
            }
        },
        stderr: (obj: LogRecord) => {
            stderr += obj['chunk'] as any;

            const charIndex = stderr.lastIndexOf('\n');
            const t = Date.now();
            if (charIndex != -1) {
                // If we have enough input for a chunk, flush it out to clients
                const readyText = stderr.slice(0, charIndex);
                stderr = stderr.slice(charIndex);

                const lines = readyText.split('\n');
                socket.emit("log:stderr", { time: t, level: "stderr", chunk: lines, properties: obj.properties });

                // Write all entries to stderr
                lines.forEach(line =>
                    line != '' && process.stderr.write(`>2:${obj.properties['gid']}:${obj.properties['tgid']}:${t};${line}\n`)
                );
            }
        }
    };
}
