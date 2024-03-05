import { logger } from './util/logger';
import { RunAgentProcess } from './agent';
import environment from './util/environment';

const agentId = environment.agentId;
const taskId  = `jobs:` + agentId.toUpperCase();

if (!agentId || !/^[0-7][0-9A-Z]{25}$/i.test(agentId)) {
    logger.fatal({ message: "Invalid agent identifier!"})
    process.exit(1);
}

process.on('unhandledRejection', (reason, p) => {
    logger.error({
        kind: "unhandledPromise",
        reason,
        p,
        stack: reason['stack']
    });
});
process.on("uncaughtException", err => {
    err['kind'] = "Uncaught";
    logger.error(err);
});

RunAgentProcess(taskId)
    .catch(ex => {
        logger.error(ex)
    });
