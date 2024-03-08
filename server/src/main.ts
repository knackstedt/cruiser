import "./types";
import express, { Express } from 'express';
import http from 'http';

import { ErrorHandler } from './util/errors';
import { logger } from './util/logger';
import { DatabaseTableApi } from './api/database-controller';
import { PipelineApi } from './api/pipeline';
import { Scheduler } from './util/scheduler';
import { JobActionsApi } from './api/job-actions';
import { SocketTunnelService } from './api/socket-tunnel';
import { TunnelApi } from './api/api-tunnel';
import { ApiTokenMiddleware } from './middleware/api-token';
import { sessionHandler } from './middleware/session';
import { OpenIDHandler } from './middleware/sso-openid';
import { UserApi } from './api/user';

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
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use((req, res, next) => {
        req.headers['x-forwarded-proto'] = "https";
        next();
    });

    app.use(express.json());
    app.use((req, res, next) => {
        if (req.get("authorization")) {
            req['_api'] = true;
            ApiTokenMiddleware(req, res, next);
        }
        else {
            req['_api'] = false;
            sessionHandler(req, res, next);
        }
    })
    app.use((req, res, next) => {
        if (req['_api']) {
            next();
        }
        else {
            OpenIDHandler(req, res, next);
        }
    })

    // app.use("/api/filesystem", FilesystemApi);
    app.use("/api/user",     UserApi);
    // Temporary access block
    app.use((req, res, next) => req.session.gh_user.login == "knackstedt" ? next() : next(401))
    app.use("/api/pipeline", PipelineApi);
    app.use("/api/jobs",     JobActionsApi);
    app.use("/api/odata",    DatabaseTableApi());
    app.use("/api/pod",      TunnelApi);

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
