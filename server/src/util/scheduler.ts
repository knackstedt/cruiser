import * as cron from 'node-cron';
import { getLogger } from './logger';
import { db } from './db';
import { PipelineDefinition, PipelineStage } from '../types/pipeline';
import { GetGitRefs } from '../api/sources';
import { RunPipeline, RunStage } from './pipeline';
import { environment } from './environment';

const logger = getLogger("job-scheduler");
const pollInterval = environment.cruiser_scheduler_poll_interval * 1000;

const scheduledCronTasks: { [key: string]: (
    cron.ScheduledTask & {
        _touched: number,
        _stage: PipelineStage
    }
)} = {};

export const CronScheduler = () => {
    // logger.info("Initializing Scheduler");

    const checkJobs = async () => {
        const [pipelines] = await db.query<[PipelineDefinition[]]>(`select * from pipeline where _isUserEditInstance = true`);

        // logger.info({
        //     msg: "Updating schedules for pipelines",
        //     count: pipelines.length
        // });
        const t = Date.now();

        for (const pipeline of pipelines) {
            let setCronJob = false;

            if (!Array.isArray(pipeline.stages)) {
                // logger.warn({
                //     msg: "Pipeline has bad stages",
                //     id: pipeline.id
                // })
                continue;
            }

            for (const stage of pipeline.stages) {

                // If the stage doesn't have a cron trigger, we don't schedule it.
                if (stage.cronTrigger?.trim()?.length == 0)
                    continue;

                // If we previously had a cron task, detect if it's been changed
                // since we last placed it.
                if (scheduledCronTasks[stage.id]) {
                    const oldStage = scheduledCronTasks[stage.id];
                    oldStage._touched = t;

                    // If the cron timer needs to be updated, reschedule it.
                    setCronJob = oldStage._stage.cronTrigger != stage.cronTrigger;
                }
                else {
                    // The stage isn't recorded yet
                    setCronJob = true;
                }

                // Attach the cron event
                if (setCronJob) {
                    if (!cron.validate(stage.cronTrigger)) {
                        // logger.warn(`Execution plan ${stage.id} has invalid CRONTAB. Skipping.`);
                        continue;
                    }

                    // logger.info(`Creating CRONTAB emitter for plan ${stage.id}`, { interval: stage.cronTrigger });

                    // Cleanup any old cron watchers
                    scheduledCronTasks[stage.id]?.stop();
                    delete scheduledCronTasks[stage.id];

                    // Add a new cron task to the listener
                    const task = cron.schedule(stage.cronTrigger, () => {
                        CheckAndTriggerStage(pipeline, stage, "$cruiser-stage-cron");
                    });

                    scheduledCronTasks[stage.id] = task as any;
                    scheduledCronTasks[stage.id]._touched = t;
                    scheduledCronTasks[stage.id]._stage = stage;

                    task.start();
                }
            }
        }

        // Remove anything that didn't get updated in the latest tick.
        Object.entries(scheduledCronTasks).forEach(([k, v]) => {
            if (v['_touched'] != t) {
                v?.stop();
                delete scheduledCronTasks[k];
            }
        })
    }

    // Start an interval and immediately trigger the check
    setInterval(() => checkJobs().catch(err => logger.error(err)), pollInterval);
};

/**
 * Check if any of the sources for the stage have been updated
 * If so, trigger a build.
 */
export const CheckAndTriggerStage = async (pipeline: PipelineDefinition, stage: PipelineStage, creatorName: string) => {
    let needsToRun = false;
    for (const source of stage.sources) {
        if (source.disabled) return;

        try {
            // TODO: authorized repos
            const refs = await GetGitRefs(source.url);

            const {hash} = refs.find(r => r.id == source.branch || "main") ?? {};
            if (!hash) {
                // TODO: Handle in some manner
                // The branch is deleted or the source is misconfigured
                continue;
            }

            // If the hash is unmodified, do nothing
            if (hash == source.lastHash)
                continue;

            // At this point, we know that the stage needs to run
            needsToRun = true;
            break;
        }
        catch(ex) {
            debugger;
        }
    }

    if (needsToRun) {
        RunPipeline(pipeline, creatorName, [stage]);
        // RunStage(null, stage);
    }
}
