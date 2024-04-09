import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import FormData from 'form-data';

import { getSocketLogger } from '../socket/logger';
import { JobInstance } from '../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { api } from './axios';
import {environment} from './environment';
import { getFilesInFolderFlat } from './fs';
import { TripBreakpoint } from '../socket/breakpoint';

const tarCompress = (
    command: string,
    args: string[],
    metadata,
    logger,
) => {
    return new Promise<ChildProcessWithoutNullStreams>(async (res, rej) => {
        const process = spawn(command, args, {
            cwd: global.process.cwd() + "/build",
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => (stdout += data) && logger.stdout({ time: Date.now(), data, scope: "sealing" }));
        process.stderr.on('data', (data) => (stderr += data) && logger.stderr({ time: Date.now(), data, scope: "sealing" }));

        process.on('error', (err) => logger.error(err));

        process.on('disconnect', (...args) => {
            logger.error({
                msg: `Process unexpectedly disconnected`,
                args
            });
            res({
                ...process,
                exitCode: -1
            } as any);
        });

        process.on('exit', (code) => {
            // If the process exits with 0 and DOESN'T print this error.
            if (code == 0 && !stderr.includes("dist: No such file or directory")) {
                logger.info({ msg: `Process exited successfully` });
                res({
                    ...metadata,
                    ...process,
                    stdout,
                    stderr
                } as any);
            }
            else {
                logger.error({ msg: `Process exited with non-zero exit code`, code });
                res({
                    ...metadata,
                    ...process,
                    exitCode: process.exitCode == 0 ? -1 : process.exitCode,
                    stdout,
                    stderr
                } as any);
            }
        });
    })
}

const compressTarLrz = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.lrz';
    return tarCompress(
        'lrztar',
        ['-z', '-o', path, dir],
        { path, dir, algorithm: "lrzip" },
        logger
    );
}

const compressTarGZip = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.gz';
    return tarCompress(
        'tar',
        ['-zcvf', path, dir],
        { path, dir, algorithm: "gzip" },
        logger
    );
}

const compressTarBZip = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.bz';
    return tarCompress(
        'tar',
        ['c -Ipbzip2 -f', dir, '-o', path],
        { path, dir, algorithm: "pbzip" },
        logger
    );
}

const compressTarZstd = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.zstd';
    return tarCompress(
        'tar',
        ['c -I"zstd" -f', dir, '-o', path],
        { path, dir, algorithm: "zstd" },
        logger
    );
}

const compressTarZstdMax = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.zstd';
    return tarCompress(
        'tar',
        ['c -I"zstd -19 -T0" -f', dir, '-o', path],
        { path, dir, algorithm: "zstd_max" },
        logger
    );
}

const compressTarPLZip = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.plz';
    return tarCompress(
        'tar',
        ['c -Iplzip -f', dir, '-o', path],
        { path, dir, algorithm: "plzip" },
        logger
    );
}

const compressTarPLZipMax = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.plz';
    return tarCompress(
        'tar',
        ['c -I"plzip -9" -f', dir, '-o', path],
        { path, dir, algorithm: "plzip_max" },
        logger
    );
}

const compressTarXZ = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.xz';
    return tarCompress(
        'tar',
        ['c -Ipxz -f', dir, '-o', path],
        { path, dir, algorithm: "xz" },
        logger
    );
}

const compressTarXZMax = (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const path = targetFile + '.tar.xz';
    return tarCompress(
        'tar',
        ['c -I"pxz -9" -f', dir, '-o', path],
        { path, dir, algorithm: "xz_max" },
        logger
    );
}

const uploadBinary = async (
    path: string,
    dirContents: Awaited<ReturnType<typeof getFilesInFolderFlat>>,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    try {
        const fileName = path.split('/').pop();

        const formData = new FormData();
        formData.append('file', fs.createReadStream(environment.buildDir + path));
        formData.append("data", JSON.stringify({
            fileName: fileName,
            autoRename: true,
            jobInstance: jobInstance.id,
            contents: dirContents
        }));

        let headers = formData.getHeaders();

        const result = await api.post(
            `/api/blobstore/upload`,
            formData,
            { headers }
        )
            .catch(err => err);

        if (result.stack)
            throw result;

        logger.info({
            msg: "Successfully uploaded artifact",
            path
        })
        return 0;
    }
    catch(err) {
        logger.warn({
            msg: "Failed to upload artifact",
            path,
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
            headers: err.config.headers,
            url: err.config.url,
            data: err.response?.data,
            responseHeaders: err.response?.headers
        })
        return -1;
    }
}

export const UploadArtifacts = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    // const compressArtifact = os.platform() == "win32"
    //     ? compressZip
    //     : compressLrztar;

    const uploads = [];

    try {
        for (const artifact of (job.artifacts ?? [])) {
            const dir = artifact.source;
            const dest = artifact.destination || artifact.label;
            const contents = await getFilesInFolderFlat(artifact.source);

            const algorithm = (() => {
                if (os.platform() == 'win32') {
                    // TODO
                    throw new Error("Not implemented!");
                }
                else {
                    switch (artifact.compressionAlgorithm) {
                        case "zstd": return compressTarZstd;
                        case "zstd_max": return compressTarZstdMax;
                        case "gzip": return compressTarGZip;
                        case "bzip": return compressTarBZip;
                        case "plzip": return compressTarXZ;
                        case "plzip_max": return compressTarXZMax;
                        case "xz": return compressTarPLZip;
                        case "xz_max": return compressTarPLZipMax;
                        case "lrzip":
                        default: return compressTarLrz;
                    }
                }
            })();

            logger.info({
                msg: `Sealing artifact '${artifact.label}'`,
                artifact
            });

            const result = await algorithm(dir, dest, logger);
            if (result.exitCode == 0) {
                logger.info({
                    msg: `Sealed artifact '${artifact.label}'`,
                    artifact,
                    result
                });
                // If it was successful in saving to disk, upload it
                if (result['path']) {
                    uploads.push(
                        uploadBinary(
                            result['path'],
                            contents,
                            jobInstance,
                            logger
                        )
                    );
                }
            }
            else {
                logger.warn({
                    msg: `Failed to seal artifact '${artifact.label}'`,
                    artifact,
                    result
                });
                await TripBreakpoint(jobInstance, false);
            }
        }

        return Promise.all(uploads);
    }
    catch(ex) {
        logger.fatal({
            msg: "Failed to seal artifacts",
            message: ex.message,
            stack: ex.stack
        })
        return null;
    }
}
