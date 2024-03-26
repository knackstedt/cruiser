import * as express from "express";
import formidable, { IncomingForm } from "formidable";
import { route } from '../util/util';
import fs, { stat } from 'fs-extra';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';
import { db } from '../util/db';
import path from 'path';

if (!environment.cruiser_blob_dir.endsWith('/')) environment.cruiser_blob_dir += '/';
fs.mkdirSync(environment.cruiser_blob_dir, { recursive: true });

const router = express.Router();

router.use('/upload', route(async (req, res, next) => {
    let form = new IncomingForm();
    form.parse(req, async function (err, fields, files) {
        if (err) {
            return next({ status: err.httpCode, message: err.message, stack: err.stack });
        }
        try {
            const uploadFiles: formidable.File[] = files as any;

            const data = JSON.parse(fields['data'][0]);
            const names = Object.keys(files);
            const localPath = data.path as string;
            const jobInstanceId = data.jobInstance as string;
            const fileName = data.fileName as string;

            let jobInstance: JobInstance;
            if (jobInstanceId) {
                [jobInstance] = await db.select<JobInstance>(jobInstanceId);

                const contents = data.contents;

                const rootPath = [
                    environment.cruiser_artifact_dir,
                    jobInstance.pipeline,
                    jobInstance.pipeline_instance,
                    jobInstance.stage,
                    jobInstance.job,
                    jobInstance.id
                ].join('/');


                await fs.mkdirp(rootPath).catch(e => null);
                await fs.move(
                    uploadFiles[0].filepath,
                    rootPath + fileName
                );
                await fs.writeJSON(rootPath + fileName + '_contents.json', contents);

                res.send({
                    url: "/api/blobstore/artifacts/" + rootPath + '/' + fileName,
                    name: fileName
                });
                return;
            }

            if (/[<>{}\\]/.test(names.join()))
                return next({ message: "Invalid upload name", status: 400 });


            let filePath = (data.path as string).replace(/\/\//g, '/'); // Remove double slashes.
            if (filePath.startsWith('/')) filePath = filePath.slice(1); // Remove leading slash.

            const keys = Object.keys(uploadFiles);
            const filePaths = [];

            for (let i = 0; i < keys.length; i++) {
                for (const file of uploadFiles[keys[i]]) {
                    filePaths.push({
                        url: "/api/blobstore/" + keys[i],
                        name: keys[i]
                    });

                    const target = (environment.cruiser_blob_dir + '/' + keys[i]);

                    await fs.mkdirp(target.slice(0, target.lastIndexOf('/'))).catch(e => null);

                    const resolvedPath = path.resolve(target);
                    // Ensure the resolved path didn't somehow exit our safely exposed directories.
                    if (
                        !resolvedPath.startsWith(environment.cruiser_log_dir) &&
                        !resolvedPath.startsWith(environment.cruiser_artifact_dir) &&
                        !resolvedPath.startsWith(environment.cruiser_blob_dir)
                    )
                        return next(400);

                    await fs.move(
                        file.filepath,
                        target
                    )
                }
            }

            res.send({ files: filePaths });
        }
        catch (ex) { next(ex); }
    });
}));


/**
 * Stream download (support Chrome media stream chunking)
 * TODO: Replace with nginx as it's more performant
 */
router.use(route(async (req, res, next) => {
    if (req.method != "GET") return next();

    // Prevent reading files via backtracking
    if (req.path.includes('..')) return next(400);

    const file = req.path.startsWith("/log/")
        ? (environment.cruiser_log_dir + '/' + req.path.replace('/log', '')).replace('//', '/')
        : req.path.startsWith("/artifact/")
        ? (environment.cruiser_artifact_dir + '/' + req.path.replace('/artifact', '')).replace('//', '/')
        : (environment.cruiser_blob_dir + '/' + req.path).replace('//', '/');
    if (!file) return next(400);

    try {
        const resolvedPath = path.resolve(file);
        // Ensure the resolved path didn't somehow exit our safely exposed directories.
        if (
            !resolvedPath.startsWith(environment.cruiser_log_dir) &&
            !resolvedPath.startsWith(environment.cruiser_artifact_dir) &&
            !resolvedPath.startsWith(environment.cruiser_blob_dir)
        )
            return next(400);

        let stats = await stat(file);

        if (req.headers.range) {
            const range = req.headers.range;
            const CHUNK_SIZE = 10 ** 6; // 1MB
            const start = Number(range.replace(/\D/g, ""));
            const end = Math.min(start + CHUNK_SIZE, stats.size - 1);
            const contentLength = end - start + 1;

            res.writeHead(206, {
                "content-range": `bytes ${start}-${end}/${stats.size}`,
                "accept-ranges": "bytes",
                "content-length": contentLength
            });

            const videoStream = fs.createReadStream(file, { start, end });
            videoStream.pipe(res);
            videoStream.on("end", () => res.end());
        }
        else { // No range was specified so we just stream the response.
            const stream = fs.createReadStream(file);
            stream.on('error', err => next(err));
            res.setHeader("content-length", stats.size);

            stream.pipe(res);
            stream.on("end", () => res.end());
        }
    }
    catch (ex) {
        next(ex);
    }
}));

export const BlobUploadApi = router;
