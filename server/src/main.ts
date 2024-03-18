import "./types";
import express, { Express } from 'express';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config({
    path: process.cwd() + '/../.env'
});

import { ErrorHandler } from './util/errors';
import { HTTPLogger, logger } from './util/logger';
import { DatabaseTableApi } from './api/database-controller';
import { PipelineApi } from './api/pipeline';
import { JobActionsApi } from './api/job-actions';
import { SocketTunnelService } from './api/socket-tunnel';
import { TunnelApi } from './api/api-tunnel';
import { ApiTokenMiddleware } from './middleware/api-token';
import { sessionHandler } from './middleware/session';
import { OpenIDHandler } from './middleware/sso-openid';
import { UserApi } from './api/user';
import { CheckJobToken } from './util/token-cache';
import { SourcesApi } from './api/sources';
import { Guest, User } from './guards/role-guards';
import { CronScheduler } from './util/scheduler';
import { BlobUploadApi } from './api/filestorage';

const isDedicatedSocketService = !!process.env['SOCKET_LISTENER'];

const bootstrapServer = async () => {
    const app: Express = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use((req, res, next) => {
        req.headers['x-forwarded-proto'] = "https";
        next();
    });

    app.use(express.json());
    app.use(HTTPLogger);
    app.use((req, res, next) => {
        const cruiserToken = req.get("X-Cruiser-Token");
        if (cruiserToken) {
            req['_agentToken'] = cruiserToken;
            return CheckJobToken(cruiserToken)
                .then(hasToken => hasToken ? next() : next(401));
        }
        if (req.get("authorization")) {
            req['_api'] = true;
            ApiTokenMiddleware(req, res, next);
        }
        else {
            req['_api'] = false;
            sessionHandler(req, res, next);
        }
    });

    // Login APIs _must_ be bound before the below
    // access block API
    app.use("/api/oauth/gh", OpenIDHandler);

    app.use((req, res, next) => {
        // Agents get to bypass the auth checks
        if (req['_agentToken']) {
            return next();
        }
        if (!req.session.profile) {
            return next(401);
        }
        if (req.session.lockout) {
            return res.send({ lockedOut: true });
        }

        if (req.method == "get") {
            Guest(req, res, next);
        }
        else {
            User(req, res, next);
        }
    });

    app.use("/api/user",      UserApi);
    app.use("/api/odata",     DatabaseTableApi());
    app.use("/api/pipelines", PipelineApi);
    app.use("/api/sources",   SourcesApi);
    app.use("/api/jobs",      JobActionsApi);
    app.use("/api/pod",       TunnelApi);
    app.use("/api/blobstore", BlobUploadApi);


    app.use((req, res, next) => next(404));
    app.use(ErrorHandler);

    const server = http.createServer(app);
    const port = 6800;
    server.listen(port);

    server.on("error", logger.error);
    server.on("listening", () => logger.info(`Server listening on port ${port}`));

    return server;
};


// If running as a dedicated socket instance, create
// an otherwise empty server.
// Also runs the schedulers in the same process.
if (isDedicatedSocketService) {
    const server = http.createServer();
    const port = 6820;
    server.listen(port);

    new SocketTunnelService(server);
    CronScheduler();
}
// Running as a clustered worker.
else if (process.env['NODE_ENV'] == 'production') {
    bootstrapServer();
}
// Development mode, run both API server and socket server.
else {
    bootstrapServer().then(server => {
        new SocketTunnelService(server);
        CronScheduler();
    })
}
