import { logger } from '../util/logger';
import { afterDatabaseConnected, db } from '../util/db';
import { JobInstance } from '../types/agent-task';
import { PipelineInstance, StageDefinition } from '../types/pipeline';
import { RunStage } from '../util/pipeline';
import axios from 'axios';


const processJobTriggers = async (jobInstance: JobInstance) => {
    // TODO: Process triggers for the subsequent jobs
    const [pipelineInstance] = await db.select<PipelineInstance>(jobInstance.pipeline_instance);

    const stage = pipelineInstance.spec.stages.find(s => s.id == jobInstance.stage);

    // Detect if all of the jobs have successfully executed for the current stage
    // const instances = pipelineInstance.status.jobInstances as any as JobInstance[];
    const [ instances ] = await db.query<[JobInstance[]]>(`select * from job_instance where pipeline_instance = '${jobInstance.pipeline_instance}'`);

    const stageJobs = instances.filter(ji => ji.stage == stage.id);
    const finishedJobs = stageJobs.filter(j => j.state == "finished");
    const failedJobs = stageJobs.filter(j => j.state == "failed" || j.state == "cancelled");

    // Check if all of the jobs in the spec have been finished
    if (stage.jobs.length == finishedJobs.length && !pipelineInstance.status.finishedStages?.includes(stage.id)) {
        // The stage is done, process triggers.

        pipelineInstance.status.finishedStages = pipelineInstance.status.finishedStages ?? [];
        pipelineInstance.status.finishedStages.push(stage.id);
        await db.merge(pipelineInstance.id, pipelineInstance);

        return ProcessStageTriggers(pipelineInstance, stage, false);
    }
    else if (stage.jobs.length == finishedJobs.length + failedJobs.length) {
        // The stage has failed or was cancelled.

        pipelineInstance.status.failedStages = pipelineInstance.status.failedStages ?? [];
        pipelineInstance.status.failedStages.push(stage.id);
        await db.merge(pipelineInstance.id, pipelineInstance);

        return ProcessStageTriggers(pipelineInstance, stage, true);
    }
    else {
        // The stage is still running
    }
};

// key: pipelineInstance.id_stage.id
const stageCompletions: {
    [key: string]: true
} = {};
const ProcessStageTriggers = async (
    pipelineInstance: PipelineInstance,
    stage: StageDefinition,
    isFailure: boolean,
) => {
    // Execute the webhooks.
    for (const webhook of (stage.webhooks ?? [])) {
        // If the job failed, only execute the webhooks that
        // are configured tp run on failure.
        if (isFailure && !webhook.executeOnFailure)
            continue;
        if (webhook.disabled)
            continue;

        const headers = webhook.headers
            ?.map(([k, v]) => ({ [k]: v }))
            .reduce((a, b) => ({ ...a, ...b }), {});

        await axios({
            method: webhook.method,
            url: webhook.url,
            data: webhook.body,
            headers: headers,
            proxy: webhook.proxy
        })
            .then(res => {
                webhook.state = 'success';
            })
            .catch(err => {
                logger.warn({
                    msg: "Executing webhook event for stage failed",
                    stage: stage.id,
                    webhook,
                    err
                });

                webhook.state = 'fail';
            });
    }

    const finishedStages = pipelineInstance.status.finishedStages;
    const stagesToTrigger = pipelineInstance.spec.stages
        // Find all stages that have a stage trigger
        .filter(s => s.stageTrigger?.length > 0)
        .filter(s => s.stageTrigger.every(t => finishedStages.includes(t)))
        .filter(s => s.stageTrigger.includes(stage.id))
        .filter(s => !finishedStages.includes(s.id));


    // TODO: Handle approval triggers
    if (stagesToTrigger.length > 0) {
        // Trigger all of the stages that need to be run.
        for (const stage of stagesToTrigger) {
            if (stage.disabled)
                continue;

            // Prevent duplicate executions
            if (stageCompletions[pipelineInstance.id + '_' + stage.id])
                continue;
            stageCompletions[pipelineInstance.id + '_' + stage.id] = true;

            // If the stage has approvals, don't automatically trigger it.
            if (stage.requiredApprovals > 0) {
                // Mark the stage as ready for approval
                pipelineInstance.status.stageApprovals = pipelineInstance.status.stageApprovals ?? [];
                pipelineInstance.status.stageApprovals.push({
                    stageId: stage.id,
                    readyForApproval: true,
                    approvalCount: 0,
                    approvers: [],
                    hasRun: false
                });
                await db.merge(pipelineInstance.id, pipelineInstance);
                continue;
            }

            // If the job failed, only execute the webhooks that
            // are configured tp run on failuire.
            if (isFailure && !stage.executeOnFailure)
                continue;

            // Run the stage
            await RunStage(pipelineInstance, stage);
        }
    }
    else {
        // If there are no pipelines left to run, we'll close out the
        // pipeline instance and collect stats for the run
        pipelineInstance.status.phase = "stopped";
        pipelineInstance.status.endEpoch = Date.now();
        pipelineInstance.stats.totalRuntime = pipelineInstance.status.endEpoch - pipelineInstance.status.startEpoch;
        await db.merge(pipelineInstance.id, pipelineInstance);
    }
};

export const EventTriggers = () => {
    afterDatabaseConnected(() => {
        const watchJobInstances = () => {
            db.live<JobInstance>("job_instance", data => {
                if (data.action == "CLOSE") return watchJobInstances();

                const job = data.result;
                if (["failed", "finished", "cancelled"].includes(job.state) && !job.hasProcessedTriggers) {
                    job.hasProcessedTriggers = true;
                    db.merge(job.id, job).then(() => processJobTriggers(job));
                }
            });
        };

        watchJobInstances();
    });
}
