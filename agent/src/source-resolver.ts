import { Pipeline, PipelineJob } from '../types/pipeline';
import execa from 'execa';
import path from 'path';
import fs from 'fs-extra';
import { simpleGit, CleanOptions, SimpleGitOptions, SimpleGit } from 'simple-git';

const options: Partial<SimpleGitOptions> = {
    baseDir: process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false,

};

export const ResolveSources = async (pipeline: Pipeline, job: PipelineJob) => {
    if (!pipeline.sources || pipeline.sources.length == 0)
        return null;

    return await Promise.all(pipeline.sources.map(async source => {
        switch (source.type) {
            case "svn": {
                throw new Error("Not Implemented");
                return;
            }
            case "tfs": {
                throw new Error("Not Implemented");
                return;
            }
            default:
            case "git": {

                const [host] = source.url.split('/');

                // TODO: Perhaps there's a clean way to read a password from a storage vault
                // or other secure manner for git?
                // seems
                fs.writeFile(`~/.gitconfig`,
                    `[credential "${host}"]\n` +
                    `	 username = ${source.username || 'DotOps'}\n` +
                    `    helper = "!f() { test \\"$1\\" = get && echo \\"password=${source.password}\\"; }; f"\n`
                    // `    helper = "!f() { test \"$1\" = get && echo \"password=$(cat $HOME/.secret)\"; }; f"\n`
                );

                const git = simpleGit(options);

                await git.clone(source.url, null, {
                    "--depth": '1'
                })
                return;

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
