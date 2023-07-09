import { SecureServer } from "@dt-esa/secure-webserver";

import { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { environment } from './environment';

import { ErrorHandler } from './errors';
import { FilesystemApi } from "./api/files";
import { TerminalSocketService } from "./api/terminal";
import { XOrgApi } from './api/xorg';
import { RestApi } from './api/rest';
import { MusicApi } from './api/music';
import { DataApi } from './db';
import { MetricSocketService } from './api/os/metrics';

(async () => {

    const server = new SecureServer({
        // Disable SSL termination in kubernetes.
        disableSSL: !!process.env['KUBERNETES_PORT'],
        port: environment.port,
        errorHandler: false,
        domain: environment.domain,
        title: "Dot Ops System",
        timeout: 2147483647,
        description: "Main client interface for Dot Ops NAS",
        accessLog: morgan((tokens, req, res) => {
            const status = tokens.status(req, res);
            const sc = status >= 500 ? 31 : status >= 400 ? 33 : status >= 300 ? 36 : status >= 200 ? 32 : 0;
            const format = [
                `\x1b[32m`,
                tokens.date('web'),
                `\x1b[0m(\x1b[34m${(
                    req.session && (
                        req.session['userinfo']?.upn ||
                        req.session['userinfo']?.mail
                    )) ||
                'anonymous'
                }\x1b[0m)`,
                '-',
                `(\x1b[${sc}m${tokens.method(req, res)}/${status}\x1b[0m)`,
                `\x1b[90m${tokens.url(req, res)}\x1b[0m`,
                '-',
                tokens['response-time'](req, res),
                'ms -',
                (res.get("content-length") || '-'),
                `b\x1b[0m`
            ].join(' ');
            // console.log(format);
            return format;
        }, {}) as any,
        startupDirectories: [],
        helmet: false
    });

    const app: Express = server.getApp();

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

    app.use("/api/filesystem", FilesystemApi);
    app.use("/api/xorg", XOrgApi);
    app.use("/api/rest", RestApi);
    app.use("/api/music", MusicApi);
    app.use("/api/data", DataApi);

    // Listen on the specified port.
    await server.start();
    const httpserver = server.getServer();
    new TerminalSocketService(httpserver);
    new MetricSocketService(httpserver);

    app.use((req, res, next) => next(404));
    app.use(ErrorHandler);
})();
