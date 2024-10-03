import { LogRecord } from '../types/agent-log';
import { environment } from './environment';

process.on('unhandledRejection', (reason, p) => {
    const error = {
        kind: "unhandledPromise",
        reason,
        p,
        stack: reason['stack']
    };
    if (!environment.is_production) {
        console.log("\x1b[1;31m", error, "\x1b[1;0m");
    }

    logger.error({ msg: reason as string, properties: {stack: reason['stack']}});
});

process.on("uncaughtException", err => {
    err['kind'] = "Uncaught";
    const error = {
        stack: err.stack,
        name: err.name,
        msg: err.message,
        ...err
    }

    if (!environment.is_production) {
        console.log("\x1b[1;31m", error, "\x1b[1;0m");
    }

    logger.error({ msg: err.message, properties: { stack: err.stack } });
});

export const logger = {
    debug(args: Partial<LogRecord> | Error) {
        const obj = {
            time: Date.now(),
            level: "debug",
            ...args,
        }
        process.stdout.write(JSON.stringify(obj) + '\n');
    },
    info(args: Partial<LogRecord> | Error) {
        const obj = {
            time: Date.now(),
            level: "info",
            ...args,
        }
        process.stdout.write(JSON.stringify(obj) + '\n');
    },
    warn(args: Partial<LogRecord> | Error) {
        const obj = {
            time: Date.now(),
            level: "warn",
            ...args,
        }
        process.stdout.write(JSON.stringify(obj) + '\n');
    },

    error(args: Partial<LogRecord> | Error) {
        const obj = {
            time: Date.now(),
            level: "error",
            ...args,
        }
        process.stderr.write(JSON.stringify(obj) + '\n');
    },
    fatal(args: Partial<LogRecord> | Error) {
        const obj = {
            time: Date.now(),
            level: "fatal",
            ...args,
        }
        process.stderr.write(JSON.stringify(obj) + '\n');
    }
}
