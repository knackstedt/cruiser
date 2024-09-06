import { createWriteStream, exists, mkdir, mkdirp, readdir } from 'fs-extra';
import { simpleGit, SimpleGitProgressEvent, SimpleGitOptions, SimpleGit } from 'simple-git';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';
import { CreateLoggerSocketServer } from '../socket/logger';
import { TripBreakpoint } from '../socket/breakpoint';
import { api } from '../util/axios';
import { decompressTarGZip, decompressTarLrz } from '../util/compression';

export const GetInputs = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    for (const artifact of (job.inputArtifacts || [])) {
        const source = pipeline.stages.flatMap(s => s.jobs).flatMap(j => j.outputArtifacts)
            .find(a => a.id == artifact.sourceArtifact);

        logger.info({
            msg: `Downloading input artifact '${artifact.label}:${source.label}'`,
            artifact,
            sourceArtifact: source
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

        const stream = await api.get(`/api/blobstore/artifact/${file}`, {
            responseType: "stream",
            responseEncoding: "binary"
        });

        await new Promise((res, rej) => {
            const targetFile = `/tmp/${artifact.id}`;
            let sWriter = createWriteStream(targetFile);
            stream.data.pipe(sWriter);
            sWriter.on("close", () => {
                try {
                    logger.info({
                        msg: `Downloaded input artifact '${artifact.label}:${source.label}'.`,
                        artifact,
                        sourceArtifact: source
                    });

                    logger.info({
                        msg: `Extracting input artifact '${artifact.label}:${source.label}'.`,
                        artifact
                    });

                    const decompress = (() => {
                        switch (source.compressionAlgorithm) {
                            case "gzip": return decompressTarGZip;
                            case "lrzip":
                            default: return decompressTarLrz;
                        }
                    })();

                    res(decompress(targetFile, artifact.destination, logger));
                }
                catch(err) {
                    rej(err);
                }
            });
            sWriter.on("error", rej);
        })
    }

    const sources = stage.sources.filter(s => !s.disabled) || [];
    if (sources.length == 0) {
        logger.debug({
            msg: `Stage '${stage.label}' has no sources to fetch`,
            stage
        })
        return null;
    }

    for (const source of sources) {
        const sourceForLog = {
            ...source,
            // prevent password from being logged
            password: undefined
        };

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
                            source: sourceForLog,
                            method,
                            stage,
                            progress
                        })
                    }
                };

                const git = simpleGit(options);

                logger.info({ msg: `Begin cloning source :git: '${repoSlug}'`, source: sourceForLog });

                const fallbackDir = pipeline.id + '/' + jobInstance.id + '/' + repoSlug;
                const cloneDir = !source.targetPath ? (environment.buildDir + '/' + (source.targetPath || fallbackDir))
                    : source.targetPath?.startsWith("/")
                    ? source.targetPath
                    : environment.buildDir + (source.targetPath ?? '');

                do {
                    await mkdirp(cloneDir);

                    if ((await readdir(cloneDir)).length > 0) {
                        logger.fatal({
                            msg: "⏸ Cannot clone into non-empty directory",
                            state: 'failed'
                        });
                    }
                    else {
                        break;
                    }
                }
                while (await TripBreakpoint(jobInstance, true))

                await git.clone(source.url, cloneDir, {
                    "--depth": source.cloneDepth ? source.cloneDepth : '1'
                });

                logger.info({ msg: `✅ Done cloning git source '${sourceForLog.label || sourceForLog.url?.split('/').pop()}'`, source: sourceForLog });

                return 0;

                // const args = [
                //     source.url,
                //     typeof source.cloneDepth == 'number' ? "--depth=" + source.cloneDepth : null,
                //     source.branch?.length > 0 ? "-b=" + source.branch : null,
                //     path.resolve(source.targetPath?.startsWith('/')
                //         ? source.targetPath
                //         : source.targetPath?.length > 0
                //         ? path.join('/build', source.targetPath)
                //         : '/build'
                //     )
                // ].filter(a => !!a);

                // return execa('git', args, { cwd: source.targetPath });
            }
        }
    }

    return 0;
}
