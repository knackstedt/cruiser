import * as express from "express";
import { logger } from './logger';

export const router = express.Router();

// Catch-all error handler.
export const ErrorHandler = (err, req, res, next) => {
    if (typeof err == "object") {
        if (err.hasOwnProperty("config") && err.config.hasOwnProperty("headers")) {
            const error = {
                message: err.message,
                status: err.status,
                code: err.code,
                headers: err.config.headers,
                url: err.config.url,
                data: err.response?.data,
                responseHeaders: err.response?.headers
            };
            logger.error(error);
            res.status(500).send(error);
            return;
        }

        // General exception
        const error = {
            message: err.msg || err.message || (!err.stack && err.toString()) || "Unknown Error",
            error: err.err ?? err.error ?? err.ex,
            status:
                (typeof err.status == "number" && err.status) ||
                (typeof err.code == "number" && err.code) ||
                500,
            stack: err.stack,
        }

        logger.error(error);
        res.status(500).send(error);
        return;
    }

    let error: any = {};
    if (typeof err == 'number') {
        let message = {
            200: "Ok",
            201: "Created",
            202: "Accepted",
            204: "No Content",
            400: "Malformed Request",
            401: "Not Authorized",
            403: "Forbidden",
            404: "Not Found",
            405: "Method Not Allowed",
            408: "Request Timeout",
            422: "Unprocessable Entity"
        }[err];
        error = {
            status: err,
            message: message ?? "Unknown Error",
            name: "HTTP Error"
        }
    }
    if (typeof err == 'string') {
        error = {
            name: "The server returned the following error",
            message: err
        }
    }

    res.status(error.status ?? 500);
    res.send(error);
};
