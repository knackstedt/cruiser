import express, { Express } from 'express';
import http from 'http';

import { ErrorHandler } from './util/errors';
import { logger } from './util/logger';
import { DatabaseTableApi } from './api/database-controller';
import { PipelineApi } from './api/pipeline';
import { Scheduler } from './util/scheduler';
import { JobActionsApi } from './api/job-actions';
import { SocketTunnelService } from './api/socket-tunnel';

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

(async () => {
    const app: Express = express();

    app.use(express.json())

    // app.use("/api/filesystem", FilesystemApi);
    app.use("/api/pipeline",   PipelineApi);
    app.use("/api/jobs",   JobActionsApi);
    app.use("/api/odata", DatabaseTableApi());

    app.use((req, res, next) => next(404));
    app.use(ErrorHandler);

    const server = http.createServer(app);
    const port = 6800;
    server.listen(port);

    server.on("error", logger.error);
    server.on("listening", () => logger.info(`Server listening on port ${port}`));

    const sts = new SocketTunnelService(server);

    // Start the CRONTAB scheduler
    Scheduler();
})();
