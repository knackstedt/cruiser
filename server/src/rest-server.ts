import express, { Express } from 'express';
import http from 'http';
import fs from 'fs-extra';

import { ErrorHandler } from './util/errors';
import { HTTPLogger, logger } from './util/logger';
import { DatabaseTableApi } from './api/database-controller';
import { PipelineApi } from './api/pipeline';
import { JobActionsApi } from './api/job-actions';
import { TunnelApi } from './api/api-tunnel';
import { ApiTokenMiddleware } from './middleware/api-token';
import { SessionMiddleware } from './middleware/session';
import { OpenIDHandler } from './middleware/sso-openid';
import { UserApi } from './api/user';
import { CheckJobToken } from './util/token-cache';
import { SourcesApi } from './api/sources';
import { EndpointGuard } from './guards/role-guards';
import { BlobUploadApi } from './api/filestorage';
import { VaultApi } from './api/vault';
import { environment } from './util/environment';
import { SystemApi } from './api/system';

export const startRestServer = async () => {
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
        // If we get an API request from an agent, we will handle that explicitly uniquely
        // TODO: Create authorization tokens for this purpose.
        const cruiserToken = req.get("X-Cruiser-Token");
        if (cruiserToken) {
            req['_agentToken'] = cruiserToken;
            CheckJobToken(cruiserToken)
                .then(hasToken => hasToken ? next() : next(401));
            return;
        }

        // If we're provided an authorization header, then we apply a completely different authn middleware.
        if (req.get("authorization")) {
            req['_api'] = true;
            ApiTokenMiddleware(req, res, next);
        }
        else {
            req['_api'] = false;
            SessionMiddleware(req, res, next);
        }
    });

    /**
     * Login APIs _must_ be bound before the below
     * access validation API
     */
    app.use("/api/oauth/gh", OpenIDHandler);

    /**
     * Guard all of the below endpoints to only authenticated sessions
     */
    app.use(EndpointGuard);
    const pack = await fs.readJson(environment.is_production ? '/app/package.json' : __dirname + '/../../package.json');
    app.use("/api/version", (req, res) => res.send({ version: pack.version }));
    app.use("/api/user", UserApi);
    app.use("/api/odata", DatabaseTableApi());
    app.use("/api/pipeline", PipelineApi);
    app.use("/api/sources", SourcesApi);
    app.use("/api/jobs", JobActionsApi);
    app.use("/api/pod", TunnelApi);
    app.use("/api/blobstore", BlobUploadApi);
    app.use("/api/vault", VaultApi);
    app.use("/api/system", SystemApi);

    app.use((req, res, next) => next(404));
    app.use(ErrorHandler);

    const server = http.createServer(app);
    server.listen(environment.cruiser_rest_port);

    server.on("error", logger.error);
    server.on("listening", () => logger.info(`REST server listening on port ${environment.cruiser_rest_port}`));

    return server;
};
