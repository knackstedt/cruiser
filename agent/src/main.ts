import express, { Express } from 'express';
import http from 'http';
import Surreal from 'surrealdb.js';

import { logger } from './util/util';
import { FilesystemApi } from './api/files';
import { Agent } from './agent';

const onFinished = require('on-finished');


const getDuration = (req, res) => {
    if (!req._startAt || !res._startAt) {
        return '0';
    }

    const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
        (res._startAt[1] - req._startAt[1]) * 1e-6;

    return ms.toFixed(2);
}

(async () => {
    const agentId = process.env['AGENT_ID'];
    const surrealUser      = process.env['SURREAL_USER'] || 'root';
    const surrealPassword  = process.env['SURREAL_PASSWORD'] || 'root';
    const surrealNamespace = process.env['SURREAL_NAMESPACE'] || 'dotglitch';
    const surrealDatabase  = process.env['SURREAL_DATABASE'] || 'dotops';
    const taskId = `jobInstance:` + agentId;

    const db = new Surreal('http://127.0.0.1:8000/rpc');
    await db.signin({
        user: surrealUser,
        pass: surrealPassword,
    });
    await db.use({ ns: surrealNamespace, db: surrealDatabase });

    process.on("uncaughtException", err => {
        logger.error("uncaught:", err);
    });

    const app: Express = express();

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
        });
        next();
    });

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

    await new Promise(r => {
        server.on("listening", () => {
            console.log(`Server listening on port ${port}`);
            r(0);
        });
    })

    await Agent(taskId, db);

    // TODO:
    // should we call process.exit here?

})();
