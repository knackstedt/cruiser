import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import os from 'os';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import FormData from 'form-data';

import { getSocketLogger } from '../socket/logger';
import { JobInstance } from '../../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { api } from './axios';
import environment from './environment';

const compressLrztar = async (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    return new Promise<ChildProcessWithoutNullStreams>(async (res, rej) => {
        try {
            const path = targetFile + '.tar.lrz';
            const process = spawn('lrztar', ['-z', '-o', path, dir], {
                cwd: global.process.cwd() + "/build",
                windowsHide: true
            });

            process.stdout.on('data', (data) => logger.stdout({ time: Date.now(), data, scope: "sealing" }));
            process.stderr.on('data', (data) => logger.stderr({ time: Date.now(), data, scope: "sealing" }));

            process.on('error', (err) => logger.error(err));

            process.on('disconnect', (...args) => {
                logger.error({
                    msg: `Process unexpectedly disconnected`,
                    args
                });
                res(process);
            });

            process.on('exit', (code) => {
                if (code == 0) {
                    logger.info({ msg: `Process exited successfully` });
                    res({
                        path: path,
                        ...process
                    } as any);
                }
                else {
                    logger.error({ msg: `Process exited with non-zero exit code`, code });
                    res({
                        path: path,
                        ...process
                    } as any);
                }
            });
        }
        catch (err) {
            // Return the process and transmit the error object
            res({
                exitCode: -1,
                err: err
            } as any);
        }
    });
}

// Fallback mechanism.
const compressZip = async (
    dir: string,
    targetFile: string,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const zip = new AdmZip();

    await zip.addLocalFolderPromise(dir, { });

    return zip.writeZipPromise(targetFile + '.zip')
        .then(res => ({ exitCode: res ? 0 : -1, path: targetFile + '.zip' }))
        .catch(err => ({ exitCode: -1, err }));
}

const uploadBinary = async (path: string, logger: Awaited<ReturnType<typeof getSocketLogger>>) => {
    try {
        const fileName = path.split('/').pop();
        const formData = new FormData();
        formData.append('file', fs.createReadStream(environment.buildDir + path), { filename: fileName });
        formData.append("data", JSON.stringify({
            path: '/artifacts/' + fileName,
            autoRename: true,
            isArtifact: true
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
    const compressArtifact = os.platform() == "win32"
        ? compressZip
        : compressLrztar;

    const uploads = [];

    for (const artifact of job.artifacts) {
        const dir = artifact.source;
        const dest = artifact.destination;
        logger.info({
            msg: "Sealing artifact " + artifact.label,
            artifact
        })
        const result = await compressArtifact(dir, dest, logger);
        if (result.exitCode == 0) {
            logger.info({
                msg: "Sealed artifact " + artifact.label,
                artifact,
                result
            })
        }
        else {
            logger.warn({
                msg: "Failed to seal artifact " + artifact.label,
                artifact,
                result
            })
        }

        // If it was successful in saving to disk, upload it
        if (result['path']) {
            uploads.push(uploadBinary(result['path'], logger))
        }
    }

    for await (let upload of uploads) {}
}
