import { readFileSync, existsSync } from "fs";
import * as express from "express";

// const v8 = require('v8');
// v8.setFlagsFromString('--stack-size=256');

export const router = express.Router();

const isProduction = process.env["NODE_ENV"]?.toLowerCase() == "production";


// Catch-all error handler.
export const ErrorHandler = (err, req, res, next) => {

    // Check request 'accept' header to see if there is a document request.
    const wantsHtml = /(text\/html|application\/xhtml\+xml)/.test(req.headers.accept);

    let jsonResult: any = {};

    switch (true) {
        case typeof err == 'number': {
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
            jsonResult = {
                status: err,
                message,
                name: "HTTP Error"
            }
            break;
        }
        case (typeof err == 'string'): {
            jsonResult = {
                name: "The server returned the following error",
                status: 500,
                message: err
            }
            break;
        }
        case (typeof err == 'object' && err.hasOwnProperty("isAxiosError")): {
            // let resBuf = err.response.data?.read();
            // let resText = resBuf?.toString();
            // let resJson = safeJsonParse(resText);
            let jsonError = err.toJSON();

            jsonResult = {
                name: err.statusText || "Axios Request Failed",
                title: err.response.statusText?.toString(),
                message: jsonError.message?.toString() || jsonError.body?.toString() || jsonError.content?.toString(),
                status:
                    (typeof jsonError.status == "number" && jsonError.status) ||
                    (typeof jsonError.code == "number" && jsonError.code) ||
                    (typeof err.response.status == "number" && err.response.status) ||
                    (typeof err.status == "number" && err.status) ||
                    (typeof err.code == "number" && err.code) ||
                    502,
                stack: jsonError.stack?.toString(),
                url: jsonError.config.url?.toString(),
                method: jsonError.config.method?.toString()
            }
            break;
        }
        case (typeof err == 'object'): {
            // General error handling
            jsonResult = {
                name: err.name?.toString() || "Request Failed",
                title: err.title?.toString() || "Failed to handle request",
                message: err.message?.toString() || (!err.stack && err.toString()) || "General Error",
                status:
                    (typeof err.response?.status == "number" && err.response?.status) ||
                    (typeof err.status == "number" && err.status) ||
                    (typeof err.code == "number" && err.code) ||
                    500,
                stack: err.stack?.toString()
            }
        }
    }

    if (!jsonResult.status) {
        jsonResult.status = 500;
        console.error("SEVERE: jsonResult status was never defined")
    }

    if (jsonResult.status >= 405) {
        if (jsonResult.constructor.name.endsWith("Error"))
            console.error(jsonResult);
        else
            console.error(`${jsonResult.name}\n${jsonResult.message}\n${jsonResult.stack}`);
    }

    // if (jsonResult.status >= 500) {
    //     const log = `[${jsonResult.status}] ` + err.name;

    //     const error = err.name?.endsWith('Error') ?
    //         err.message + "\n" + err.stack :
    //         JSON.stringify(err)

    //     // The only reason we are using userInfo here is in case there is a failure
    //     // During the signon process.
    //     const email = req.session?.userInfo?.mail || req.session?.userInfo?.upn || "anonymous";
    // }

    // Remove stacktrace information from the reported error in higher environments
    // Higher-level environments should not have code or stacktraces exposed.
    if (!req.session?.profile?.isAdmin && isProduction) {
        delete jsonResult.stack;  // Stacktrace includes code.
        delete jsonResult.url;    // Internally used url from Axios error.
        delete jsonResult.method; // Internally used method from Axios error.

        if (jsonResult.message.includes("ECONNREFUSED"))
            jsonResult.message = "Failed to connect to downstream provider";
    }

    res.status(jsonResult.status);
    res.send(jsonResult);
};
