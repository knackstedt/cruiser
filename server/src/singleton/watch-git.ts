import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from '../util/logger';
import { afterDatabaseConnected, db } from '../util/db';
import { PipelineDefinition, PipelineSource, PipelineStage } from '../types/pipeline';
import { RunPipeline, RunStage } from '../util/pipeline';
import { StringRecordId } from 'surrealdb';


const pollingInterval = 15;
const watchedSources: {
    id: string
    interval: number,
    stage: PipelineStage,
    source: PipelineSource
}[] = [];

const WatchSource = (pipeline: PipelineDefinition, stage: PipelineStage, source: PipelineSource) => {
    UnwatchSource(stage, source);

    // Start polling
    const interval = setInterval(async () => {
        if (!source.url || source.url == "undefined") {
            logger.warn({
                msg: `Cannot poll repository with invalid source URL`,
                source
            });
            return;
        }
        const branchResponse = await simpleGit().listRemote([source.url]).catch(err => {
            // Something failed. Either the remote is invalid or there was some network error.
            logger.error({
                msg: err.message,
                stack: err.stack
            });
            return null;
        });
        const lines = branchResponse?.trim().split('\n').filter(l => l.trim().length > 0);

        // If an error is thrown then we'll handle that specifically
        if (!lines) {
            return;
        }

        // [branch, hash]
        // filter to only head refs
        // TODO: Should this support multiple remote types such as PRs?
        const hashArray = lines.map(l => l.split('\t').reverse())
            .filter(([branchPath]) => branchPath.startsWith('refs/heads/'));

        source.lastGitHash ??= {};

        let hasDirtyBranch = false;
        hashArray.forEach(([branch, hash]) => {
            // Compare the previous hash with what we just fetched.
            if (source.lastGitHash[branch] && source.lastGitHash[branch] != hash) {
                // The hashes do not match, so we need to attempt to run the pipeline.

                // If a branch/filter is not provided, treat it as an *
                // otherwise, make sure the branch matches.
                // TODO: glob / regex format support
                if (
                    (!source.branch && !source.branchFilter) ||
                    source.branch == branch || source.branchFilter.includes(branch)
                ) {
                    // At this point we know that the source has been tainted and needs
                    // to be built :)
                    hasDirtyBranch = true;
                }
            }
            // Always record updates to the stored hash.
            source.lastGitHash[branch] = hash;
        })

        if (hasDirtyBranch) {
            const latestPipeline = await db.select<PipelineDefinition>(new StringRecordId(pipeline.id));

            await RunPipeline(latestPipeline, "$cruiser", [stage]);

            const remoteStage = latestPipeline.stages.find(ps => ps.id == stage.id);
            const remoteSource = remoteStage.sources.find(rs => rs.id == source.id);

            // Save the changes for the last git hash.
            // TODO: This entire process seems overcomplicated and prone to failure
            remoteSource.lastGitHash = source.lastGitHash;

            // Save the changes
            await db.merge(new StringRecordId(latestPipeline.id), latestPipeline);
        }
    }, (source.pollIntervalSeconds || pollingInterval) * 1000);

    watchedSources.push({
        id: stage.id + '_' + source.id,
        interval: interval as any,
        stage,
        source
    });
}

const WatchStage = (pipeline: PipelineDefinition, stage: PipelineStage) => {
    stage.sources?.forEach(source => {
        if (source.pollForUpdates === false) return;
        WatchSource(pipeline, stage, source);
    })
}

const UnwatchSource = (stage: PipelineStage, source: PipelineSource) => {
    const id = stage.id + '_' + source.id;
    const sourceWatcher = watchedSources.find(r => r.id == id);

    if (!sourceWatcher) return;

    // Clear the interval and remove the watcher
    clearInterval(sourceWatcher.interval);
    watchedSources.splice(watchedSources.indexOf(sourceWatcher), 1);
}

const UnwatchStage = (stage: PipelineStage) => {
    stage.sources?.forEach(source => UnwatchSource(stage, source));
}

export const GitWatcher = () => {
    afterDatabaseConnected(() => {
        const watchPipelines = () => {
            // Watch for changes on the pipeline table
            db.live<PipelineDefinition>("pipeline", (action, result) => {
                if (action == "CLOSE") return watchPipelines();

                const pipeline = result;
                if (pipeline._isUserEditInstance) return;

                // Remove the watchers
                if (action == "DELETE" || pipeline.state != "active") {
                    pipeline.stages?.forEach(stage => {
                        UnwatchStage(stage);
                    })
                }
                else {
                    // Pipeline **must** be active to have an active watcher.
                    pipeline.stages?.forEach(stage => {
                        WatchStage(pipeline, stage);
                    })
                }
            });
        };

        watchPipelines();

        // state != 'paused' AND
        db.query<PipelineDefinition[][]>("SELECT * FROM pipeline WHERE _isUserEditInstance != true AND state == 'active'").then(([pipelines]) => {
            pipelines.forEach(pipeline => {
                pipeline.stages?.forEach(stage => {
                    WatchStage(pipeline, stage);
                })
            })
        })
    });
};
