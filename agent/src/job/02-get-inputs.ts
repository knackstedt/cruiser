import { createWriteStream, exists, mkdir, readdir } from 'fs-extra';
import { simpleGit, SimpleGitProgressEvent, SimpleGitOptions, SimpleGit } from 'simple-git';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';
import { getSocketLogger } from '../socket/logger';
import { TripBreakpoint } from '../socket/breakpoint';
import { api } from '../util/axios';

export const GetInputs = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    job: JobDefinition,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    await Promise.all(job.inputArtifacts?.map(async artifact => {
        const source = pipeline.stages.flatMap(s => s.jobs).flatMap(j => j.outputArtifacts)
            .find(a => a.id == artifact.sourceArtifact);

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

        return new Promise((res, rej) => {
            let sWriter = createWriteStream(`/tmp/${artifact.id}`);
            stream.data.pipe(sWriter);
            sWriter.on("close", () => {
                try {

                }
                catch(err) {
                    rej(err);
                }
            });
            sWriter.on("error", err => {
                rej(err)
            });
        })
    }) ?? []);

    const sources = stage.sources;
    if (!sources || sources.length == 0)
        return null;

    return await Promise.all(sources.map(async source => {

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
                //     // `    helper = "!f() { test \"$1\" = get && echo \"password=$(cat $HOME/.secret)\"; }; f"\n`
                // );

                const options: Partial<SimpleGitOptions> = {
                    baseDir: process.cwd(),
                    binary: 'git',
                    maxConcurrentProcesses: 6,
                    trimmed: false,
                    progress: ({ method, stage, progress }: SimpleGitProgressEvent) => {
                        // console.log(`git.${method} ${stage} stage ${progress}% complete`);
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

                logger.info({ msg: `Cloning GIT source`, source: sourceForLog });

                const cloneDir = source.targetPath?.startsWith("/")
                    ? source.targetPath
                    : environment.buildDir + (source.targetPath ?? '');

                if (!await exists(cloneDir))
                    await mkdir(cloneDir, { recursive: true });

                if ((await readdir(cloneDir)).length > 0) {
                    logger.fatal({
                        msg: "Cannot clone into non-empty directory",
                        state: 'failed'
                    });

                    await TripBreakpoint(jobInstance, false);
                    return 1;
                }

                await git.clone(source.url, cloneDir, {
                    "--depth": source.cloneDepth ? source.cloneDepth : '1'
                })

                logger.info({ msg: `Done cloning git source '${sourceForLog.label}'`, source: sourceForLog });

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
    }));
}
