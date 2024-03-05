import { homedir } from 'os';
import fs, { exists, mkdir, readdir } from 'fs-extra';
import { simpleGit, SimpleGitProgressEvent, SimpleGitOptions, SimpleGit } from 'simple-git';
import { logger } from './logger';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';
import environment from '../util/environment';
import { TripBreakpoint } from '../util/breakpoint';
import { JobInstance } from '../../types/agent-task';

export const ResolveSources = async (pipeline: PipelineDefinition, jobInstance: JobInstance) => {
    if (!pipeline.sources || pipeline.sources.length == 0)
        return null;

    return await Promise.all(pipeline.sources.map(async source => {

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

                const [host] = source.url.split('/');

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
                            msg: `Cloning progress`,
                            source: sourceForLog,
                            method,
                            stage,
                            progress
                        })
                    }
                };

                const git = simpleGit(options);

                logger.info({ msg: `Cloning GIT source`, source: sourceForLog });

                if (!await exists(environment.buildDir))
                    await mkdir(environment.buildDir, { recursive: true });

                if ((await readdir(environment.buildDir)).length > 0) {
                    logger.fatal({
                        msg: "Cannot clone into non-empty directory",
                        state: 'failed'
                    });

                    await TripBreakpoint(jobInstance);
                    return 1;
                }

                await git.clone(source.url, environment.buildDir, {
                    "--depth": '1'
                })

                logger.info({ msg: `Done cloning GIT source`, source: sourceForLog });

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
