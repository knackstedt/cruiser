import express, { Express } from 'express';
import helmet from 'helmet';
import http from 'http';

import { logger } from './util';

const onFinished = require('on-finished');

process.on("uncaughtException", err => {
    logger.error("uncaught:", err);
});

const getDuration = (req, res) => {
    if (!req._startAt || !res._startAt) {
        return '0';
    }

    const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
        (res._startAt[1] - req._startAt[1]) * 1e-6;

    return ms.toFixed(2);
}

(async () => {
    const app: Express = express();

    app.use(helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
            "default-src": ["'self'",],
            "frame-ancestors": ["'self'"],
            "frame-src": ["'self'"],
            "font-src": ["'self'", "data:"],
            "form-action": ["'self'"],
            "img-src": ["*", "data:"],
            "media-src": ["'self'", "blob:" ],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "script-src-attr": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            // "report-uri": ["/api/Security/Violation"],
            "worker-src": ["'self'", "blob:"]
        }
    }));
    app.use(helmet.dnsPrefetchControl({ allow: false }));
    app.use(helmet.frameguard({ action: "sameorigin" }));
    app.use(helmet.hidePoweredBy());
    // app.use(helmet.hsts({ maxAge: 86400 * 7 }));
    app.use(helmet.permittedCrossDomainPolicies());
    app.use(helmet.referrerPolicy());
    app.use(helmet.xssFilter());
    app.use((req, res, next) => {
        onFinished(req, () => {
            logger.info({
                kind: "http",
                method: req.method,
                status: res.status,
                url: req.url,
                size: (parseInt(res.get("content-length")) || 0),
                duration: getDuration(req, res)
            });
        })
        next();
    })

    app.use("/api/filesystem", FilesystemApi);

    app.use((req, res, next) => next(404));

    const server = http.createServer(app);
    const port = 3000;
    server.listen(port);
    server.on("error", (e: any) => console.error(e.code == "EACCES"
            ? `Port ${port} requires elevated permissions`
            : e.code == "EADDRINUSE"
            ? `Port ${port} is already in use`
            : e
        )
    );
    server.on("listening", () => console.log(`Server listening on port ${port}`));

    new TerminalSocketService(httpserver);

})();
