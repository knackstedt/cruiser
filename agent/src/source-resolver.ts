import { Pipeline, PipelineJob } from '../types/pipeline';
import { execa } from 'execa';
import path from 'path'

export const ResolveSources = async (pipeline: Pipeline, job: PipelineJob) => {
    if (!pipeline.sources || pipeline.sources.length == 0)
        return null;

    return await Promise.all(pipeline.sources.map(s => {
        switch (s.type) {
            case "git": {
                const args = [
                    s.url,
                    typeof s.cloneDepth == 'number' ? "--depth=" + s.cloneDepth : null,
                    s.branch?.length > 0 ? "-b=" + s.branch : null,
                    path.resolve(s.targetPath?.startsWith('/')
                        ? s.targetPath
                        : s.targetPath?.length > 0
                        ? path.join('/build', s.targetPath)
                        : '/build'
                    )
                ].filter(a => !!a);

                return execa('git', args, { cwd: s.targetPath });
            }
            case "svn": {
                throw new Error("Not Implemented");
                return;
            }
            case "tfs": {
                throw new Error("Not Implemented");
                return;
            }
        }
    }));
}
