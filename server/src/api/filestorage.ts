import * as express from "express";
import formidable, { IncomingForm } from "formidable";
import { route } from '../util/util';
import fs, { stat } from 'fs-extra';

let blobStore = process.env['CRUISER_BLOBSTORE_PATH'] ?? __dirname + "/../../../../data";
if (!blobStore.endsWith('/')) blobStore += '/';
fs.mkdirSync(blobStore, { recursive: true });

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
            const path = data.path == "/" ? "/" : data.path.substring(1);

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
                    })
                    await fs.move(file.filepath, blobStore + keys[i])
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

    const file: string = (blobStore + '/' + req.path).replace('//', '/');
    if (!file) return next(400);

    try {
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
