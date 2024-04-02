import pino from 'pino';
import { getHeapStatistics } from 'v8';
import express from 'express';
import onFinished from 'on-finished';
import { environment } from './environment';

export const getLogger = (file: string) => pino({
    mixin: (_context, level) => {
        return {
            logLevel: { 10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL" }[level],
        };
    },
    transport: {
        targets: [
            {
                level: 'trace',
                target: 'pino/file',
                options: {
                    destination: `log/${file}.log`,
                    mkdir: true
                },
            },
            {
                target: 'pino/file', level: 'trace', options: { destination: 1 }
            }
        ]
    }
});

const _logger = getLogger(`verbose-${process.pid}`);

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

_logger.info({
    message: "Application Started",
    cwd: process.cwd(),
    ...Object.entries(heapStats).map(([k, v]) => ({
        [k]: toGb(v)
    })).reduce((a, b) => ({ ...a, ...b }), {}),
});


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
    _logger.error(error);
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
    _logger.error(error);
});

export const logger = _logger;

const httpLogger = getLogger("http");
const router = express.Router();


const getDuration = (req, res) => {
    if (!req._startAt || !res._startAt) {
        // missing request and/or response start time
        return null;
    }

    // calculate diff
    var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;

    // return truncated value
    return ms.toFixed(2);
};

router.use((req, res, next) => {

    onFinished(req, () => {
        const length = parseInt(res.get("content-length"));
        httpLogger.info({
            user: req['session']?.gh_user?.login,
            agent: req.get("X-Cruiser-Token") ? req.get("X-Cruiser-Agent") : null,
            ip: req.ip,
            method: req.method,
            status: res.statusCode,
            url: req.url,
            size: Number.isNaN(length) ? null : length,
            duration: getDuration(req, res)
        });
    });
    next();
})

export const HTTPLogger = router;
