import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import FormData from 'form-data';

import { getSocketLogger } from '../socket/logger';
import { JobInstance } from '../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { api } from '../util/axios';
import {environment} from '../util/environment';
import { getFilesInFolderFlat } from '../util/fs';
import { TripBreakpoint } from '../socket/breakpoint';
import { compressTarGZip, compressTarLrz } from '../util/compression';



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
        for (const artifact of (job.outputArtifacts ?? [])) {
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
                        case "gzip": return compressTarGZip;
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
            msg: "Failed to seal outputArtifacts",
            message: ex.message,
            stack: ex.stack
        })
        return null;
    }
}
