import pino from 'pino';
import os from 'os';
import { getHeapStatistics } from 'v8';

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

export const logger = _logger;
