import "./types";
import express from 'express';
import http from 'http';

import { HTTPLogger, logger } from './util/logger';
import { RunAgentProcess } from './agent';
import environment from './util/environment';
import { FilesystemApi } from './api/filesystem';

if (
    !process.env['CRUISER_AGENT_ID'] ||
    !/^[0-7][0-9A-Z]{25}$/i.test(process.env['CRUISER_AGENT_ID'].toUpperCase())
) {
    logger.fatal({ message: "Invalid agent identifier!"})
    process.exit(1);
}

(async () => {
    const app = express();

    // Handle a ping endpoint to check if this is even up
    app.use("/ping", (req, res, next) => res.send(Date.now().toString()));
    app.use((req, res, next) => {
        // Ensure the access is only coming from the system that spawned this agent
        if (environment.cruiserToken == req.get("X-Cruiser-Token"))
            return next();

        res
            .status(401)
            .send();
    })

    app.use(express.json());
    app.use(HTTPLogger);

    app.use("/fs", FilesystemApi);


    app.use((req, res, next) => next(404));
    app.use((err, req, res, next) => {
        logger.error(err);

        res
            .status(500)
            .send(err.hasOwnProperty("isAxiosError") ? {
                message: err.message,
                status: err.status,
                code: err.code,
                headers: err.config.headers,
                url: err.config.url,
                data: err.response?.data,
                responseHeaders: err.response?.headers
            } : err);
    });

    const server = http.createServer(app);
    const port = 8080;
    server.listen(port);

    server.on("error", logger.error);
    server.on("listening", () => logger.info(`Server listening on port ${port}`));
})();

RunAgentProcess(environment.jobInstanceId)
    .catch(ex => {
        logger.error(ex)
    })
    .then(() => {
        process.exit(0)
    })
