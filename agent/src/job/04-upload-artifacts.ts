import fs from 'fs-extra';
import os from 'os';
import FormData from 'form-data';
import { context, Span, trace } from '@opentelemetry/api';

import { CreateLoggerSocketServer } from '../socket/logger';
import { JobInstance } from '../types/agent-task';
import { PipelineJobDefinition, PipelineDefinition, PipelineInstance, PipelineStage } from '../types/pipeline';
import { api } from '../util/axios';
import {environment} from '../util/environment';
import { getFilesInFolderFlat } from '../util/fs';
import { TripBreakpoint } from '../socket/breakpoint';
import { compressTarGZip, compressTarLrz } from '../util/compression';
import path from 'path';

const tracer = trace.getTracer('agent-artifact-upload');

const uploadBinary = async (
    parentSpan: Span,
    path: string,
    dirContents: Awaited<ReturnType<typeof getFilesInFolderFlat>>,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => tracer.startActiveSpan(
    "UploadArtifact",
    undefined,
    trace.setSpan(context.active(), parentSpan
),
    async span => {
    try {
        const fileName = path.split('/').pop();
        const sourceDir = environment.buildDir + path;

        const formData = new FormData();
        formData.append('file', fs.createReadStream(sourceDir));
        formData.append("data", JSON.stringify({
            fileName: fileName,
            autoRename: true,
            jobInstance: jobInstance.id,
            contents: dirContents
        }));

        span.setAttributes({
            fileName,
            sourceDir
        })

        let headers = formData.getHeaders();

        const result = await api.post(
            span,
            `/api/blobstore/upload`,
            formData,
            { headers }
        )
            .catch(err => err);

        if (result.stack)
            throw result;

        logger.info({
            msg: `Successfully uploaded artifact \`${path}\``,
            properties: {
                path
            }
        })
        return 0;
    }
    catch(err) {
        logger.warn({
            msg: `Failed to upload artifact \`${path}\``,
            properties: {
                path,
                name: err.name,
                msg: err.message,
                stack: err.stack,
                code: err.code,
                headers: err.config.headers,
                url: err.config.url,
                data: err.response?.data,
                responseHeaders: err.response?.headers
            }
        })
        return -1;
    }
});

export const UploadArtifacts = async (
    parentSpan: Span,
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: PipelineStage,
    job: PipelineJobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => tracer.startActiveSpan(
    "UploadArtifacts",
    undefined,
    trace.setSpan(context.active(), parentSpan),
    async span => {
    // const compressArtifact = os.platform() == "win32"
    //     ? compressZip
    //     : compressLrztar;

    const uploads = [];

    try {
        for (const artifact of (job.outputArtifacts ?? [])) {
            const dir = path.resolve(artifact.source);
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
                msg: `Sealing artifact \`${artifact.label}\``,
                properties: {
                    artifact
                }
            });

            const result = await tracer.startActiveSpan(
                "CompressArtifact",
                undefined,
                trace.setSpan(context.active(), parentSpan),
                async span => {
                span.setAttributes({
                    algorithm: artifact.compressionAlgorithm
                });

                return algorithm(dir, dest, logger).finally(() => span.end());
            });

            if (result.exitCode == 0) {
                logger.info({
                    msg: `Sealed artifact \`${artifact.label}\``,
                    properties: {
                        artifact,
                        result
                    }
                });

                // If it was successful in saving to disk, upload it
                if (result['path']) {
                    uploads.push(
                        uploadBinary(
                            span,
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
                    msg: `⏸ Failed to seal artifact \`${artifact.label}\``,
                    properties: {
                        artifact,
                        result
                    }
                });
                await TripBreakpoint(span, jobInstance, false, false);
            }
        }

        const res = await Promise.all(uploads);
        span.end();
        return res;
    }
    catch(ex) {
        logger.fatal({
            msg: "Failed to seal outputArtifacts",
            properties: {
                msg: ex.message,
                stack: ex.stack
            }
        })
        span.end();
        return null;
    }
})

