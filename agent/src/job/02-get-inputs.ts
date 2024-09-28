import { createWriteStream, exists, mkdir, mkdirp, readdir } from 'fs-extra';
import { simpleGit, SimpleGitProgressEvent, SimpleGitOptions, SimpleGit } from 'simple-git';
import { context, Span, trace } from '@opentelemetry/api';

import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';
import { CreateLoggerSocketServer } from '../socket/logger';
import { TripBreakpoint } from '../socket/breakpoint';
import { api } from '../util/axios';
import { decompressTarGZip, decompressTarLrz } from '../util/compression';
import path from 'path';

const tracer = trace.getTracer('agent-source-fetch');

export const GetInputs = async (
    parentSpan: Span,
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    const artifacts = (job.inputArtifacts || []);

    const ctx = trace.setSpan(context.active(), parentSpan);
    await tracer.startActiveSpan("FetchArtifacts", undefined, ctx, async span => {
        for (const artifact of artifacts) {
            const source = pipeline.stages.flatMap(s => s.jobs).flatMap(j => j.outputArtifacts)
                .find(a => a.id == artifact.sourceArtifact);

            logger.info({
                msg: `Downloading input artifact \`${artifact.label}:${source.label}\``,
                properties: {
                    artifact,
                    sourceArtifact: source.id
                }
            });

            if (!source) {
                logger.warn({ })
                return null;
            }

            const file = [
                pipeline.id,
                pipelineInstance.id,
                stage.id,
                job.id,
                jobInstance.id,
                source.destination
            ].join("/");

            const stream = await api.get<any>(span, `/api/blobstore/artifact/${file}`, {
                responseType: "stream",
                responseEncoding: "binary"
            });

            await new Promise((res, rej) => {
                const ctx = trace.setSpan(context.active(), span);
                tracer.startActiveSpan("DownloadArtifact", undefined, ctx, async span => {
                    const targetFile = `/tmp/${artifact.id}`;
                    let sWriter = createWriteStream(targetFile);
                    stream.data.pipe(sWriter);
                    sWriter.on("close", () => {
                        try {
                            logger.info({
                                msg: `Downloaded input artifact \`${artifact.label}:${source.label}\`.`,
                                properties: {
                                    artifact,
                                    sourceArtifact: source.id
                                }
                            });

                            const decompress = (() => {
                                switch (source.compressionAlgorithm) {
                                    case "gzip": return decompressTarGZip;
                                    case "lrzip":
                                    default: return decompressTarLrz;
                                }
                            })();

                            span.end();
                            res(decompress(targetFile, path.resolve(artifact.destination), logger));
                        }
                        catch(err) {
                            span.end();
                            rej(err);
                        }
                    });
                    sWriter.on("error", err => {
                        span.end();
                        rej(err);
                    });
                });
            })
        }
        span.end();
    })

    await tracer.startActiveSpan("FetchSources", undefined, ctx, async span => {
        const sources = stage.sources?.filter(s => !s.disabled) || [];
        if (sources.length == 0) {
            logger.debug({
                msg: `Stage \`${stage.label}\` has no sources to fetch`,
                properties: {
                    stage: stage.id
                }
            })
            span.end();
            return null;
        }

        for (const source of sources) {
            if (source.disabled) continue;

            const ctx = trace.setSpan(context.active(), span);
            await tracer.startActiveSpan("FetchSource", undefined, ctx, async span => {
                const sourceForLog = {
                    ...source,
                    // prevent password from being logged
                    password: undefined
                };

                span.setAttributes({
                    'source.id': source.id,
                    'source.url': source.url,
                    'source.branch': source.branch
                });

                try {
                    switch (source.type) {
                        case "svn": {
                            throw new Error("Not Implemented");
                            return 0;
                        }
                        case "tfs": {
                            throw new Error("Not Implemented");
                            return 0;
                        }
                        default:
                        case "git": {

                            // const [host] = source.url.split('/');

                            // TODO: Perhaps there's a clean way to read a password from a storage vault
                            // or other secure manner for git?
                            // seems
                            // fs.writeFile(homedir() + `/.gitconfig`,
                            //     `[credential "${host}"]\n` +
                            //     `	 username = ${source.username || 'DotOps'}\n` +
                            //     `    helper = "!f() { test \\"$1\\" = get && echo \\"password=${source.password}\\"; }; f"\n`
                            //     // ` w   helper = "!f() { test \"$1\" = get && echo \"password=$(cat $HOME/.secret)\"; }; f"\n`
                            // );
                            const repoSlug = source.url.split('/').pop().replace(/\.git$/, '');
                            const options: Partial<SimpleGitOptions> = {
                                baseDir: environment.buildDir,
                                binary: 'git',
                                maxConcurrentProcesses: 6,
                                trimmed: false,
                                progress: ({ method, stage, progress }: SimpleGitProgressEvent) => {
                                    logger.info({
                                        msg: `:git: ${stage} objects: ${progress.toString().padStart(3, " ")}%`,
                                        properties: {
                                            source: sourceForLog.id,
                                            method,
                                            stage,
                                            progress
                                        }
                                    })
                                }
                            };

                            const git = simpleGit(options);
                            const cloneDir = path.resolve(source.targetPath);

                            logger.info({ msg: `Begin cloning source :git: \`${repoSlug}\``, properties: { source: sourceForLog.id } });

                            do {
                                try {
                                    await mkdirp(cloneDir);

                                    if ((await readdir(cloneDir)).length > 0) {
                                        logger.fatal({
                                            msg: `⏸ Cannot clone \`${repoSlug}\` into non-empty directory \`${cloneDir}\``,
                                            properties: {
                                                source: sourceForLog
                                            }
                                        });
                                    }
                                    else {
                                        break;
                                    }
                                }
                                catch(ex) {
                                    logger.error({
                                        msg: `❌ Failed to access directory \`${cloneDir}\` for \`${repoSlug}\``,
                                        properties: {
                                            path: cloneDir,
                                            source: sourceForLog
                                        }
                                    });
                                }
                            }
                            while (await TripBreakpoint(span, jobInstance, true, false))

                            await git.clone(source.url, cloneDir, {
                                "--depth": source.cloneDepth ? source.cloneDepth : '1'
                            });

                            logger.info({
                                msg: `✅ Done cloning git source \`${source.label || source.url?.split('/').pop()}\``,
                                properties: {
                                    source: sourceForLog.id
                                }
                            });
                        }
                    }
                }
                catch(ex) {
                    span.addEvent("FetchError", {
                        "source.id": source.id,
                        "source.label": source.label,
                        "source.url": source.url,
                        "source.branch": source.branch,
                        "source.branchFilter": source.branchFilter,
                        "source.cloneDepth": source.cloneDepth,
                        "source.invertFilter": source.invertFilter,
                        "source.targetPath": source.targetPath,
                        "source.type": source.type,
                        "error.message": ex.message,
                        "error.stack": ex.stack
                    });

                    logger.error({
                        msg: `❌ Failed to download source \`${source.label || source.url?.split('/').pop() }\`: ` + ex.message,
                        properties: {
                            source: sourceForLog,
                            ...ex
                        }
                    });
                }

                span.end();
            });
        }

        span.end();
        return 0;
    })
}
