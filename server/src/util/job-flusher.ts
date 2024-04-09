import fs, { stat } from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import { logger } from './logger';
import { db } from './db';
import { JobInstance } from '../types/agent-task';
import { environment } from './environment';
import { PipelineInstance } from '../types/pipeline';
import { RunStage } from './pipeline';
import axios from 'axios';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sWatch = new k8s.Watch(kc);

if (!environment.cruiser_log_dir.endsWith('/')) environment.cruiser_log_dir += '/';
fs.mkdirSync(environment.cruiser_log_dir, { recursive: true });

export const WatchAndFlushJobs = async() => {
    const podMap: { [key: string]: k8s.V1Pod | 0 } = {};
    const watchPods = () => k8sWatch.watch(`/api/v1/namespaces/${environment.cruiser_kube_namespace}/pods`,
        {},
        (type, apiObj, watchObj) => {
            if (type != 'MODIFIED') {
                return;
            }

            const pod = watchObj.object as k8s.V1Pod;

            // Ensure this is a cruiser-spawned job
            if (pod.metadata.annotations?.['cruiser.dev/created-by'] != "$cruiser")
                return;

            if (pod.status.phase == "Running") {
                podMap[pod.metadata.annotations?.['cruiser.dev/job-instance-id']] = pod;
            }
        },
        (err) => {
            console.error(err);
            watchPods();
        }
    )

    const watchJobs = () => k8sWatch.watch(`/apis/batch/v1/namespaces/${environment.cruiser_kube_namespace}/jobs`,
        { },
        async (type, apiObj, watchObj) => {
            if (type != 'MODIFIED') {
                return;
            }

            const job = watchObj.object as k8s.V1Job;

            // Ensure this is a cruiser-spawned job
            if (job.metadata.annotations?.['cruiser.dev/created-by'] != "$cruiser")
                return;


            const isComplete = job.status.conditions?.find(c => c.type == "Complete" && c.status);
            const isFailed = job.status.conditions?.find(c => c.type == "Failed" && c.status);
            // const isSuspended = job.status.conditions?.find(c => c.type == "Suspended" && c.status);

            // This tells us when the job is done.
            if (isComplete || isFailed) {
                const pod = podMap[job.metadata.annotations['cruiser.dev/job-instance-id']];
                podMap[job.metadata.annotations['cruiser.dev/job-instance-id']] = 0;

                // If the pod was consumed and we have a duplicate event, do nothing.
                if (pod === 0) {
                    return;
                }
                if (!pod) {
                    logger.fatal({
                        msg: "Somehow we don't have a pod recorded for a successful job",
                        job
                    })
                    return;
                }

                SaveLogAndCleanup(pod, job);
            }
        },
        (err) => {
            console.error(err);
            watchJobs();
        }
    );

    watchPods();
    watchJobs();
    SweepJobs();
};


// In addition to the watchers, we will check every 30 seconds
// for jobs that may have fallen through the cracks.
// This helps us handle server restarts without leaving jobs up in the air
// in a few rare conditions.
const flushInterval = 30000;
const SweepJobs = async () => {

    try {
        const { body: result } = await k8sBatchApi.listNamespacedJob(environment.cruiser_kube_namespace);
        const { body: pods } = await k8sApi.listNamespacedPod(environment.cruiser_kube_namespace);

        const jobs = result.items;

        for (const job of jobs) {
            // Ensure we only perform operations on pods we expect to
            if (job.metadata.annotations['cruiser.dev/created-by'] != "$cruiser")
                continue;

            const isRunning = job.status.active > 0;

            // If the job isn't running, download the entire log
            if (!isRunning) {
                const pod = pods.items.find(p => p.metadata.annotations?.['cruiser.dev/job-id'] == job.metadata.annotations['cruiser.dev/job-id']);

                if (!pod) {
                    logger.warn({
                        msg: "Completed job pod has been removed prematurely.",
                        job
                    });
                    continue;
                }

                await SaveLogAndCleanup(pod, job);
            }
        }
    }
    catch(ex) {
        logger.error({
            msg: "Error flushing out jobs",
            name: ex.name,
            message: ex.message,
            stack: ex.stack
        })
    }

    setTimeout(SweepJobs.bind(this), flushInterval);
}

const SaveLogAndCleanup = async (pod: k8s.V1Pod, job: k8s.V1Job) => {
    const { body: log } = await k8sApi.readNamespacedPodLog(pod.metadata.name, pod.metadata.namespace);

    const dir = [
        environment.cruiser_log_dir,
        job.metadata.annotations['cruiser.dev/pipeline-id'],
        job.metadata.annotations['cruiser.dev/pipeline-instance-id'],
        job.metadata.annotations['cruiser.dev/stage-id'],
        job.metadata.annotations['cruiser.dev/job-id'],
    ].join('/');

    // Create the target dir
    await fs.mkdir(dir, { recursive: true });

    // Write the file to disk.
    await fs.writeFile(
        dir + '/' + job.metadata.annotations['cruiser.dev/job-instance-id'] + ".log",
        log
    );

    const [jobInstance] = await db.select<JobInstance>(job.metadata.annotations['cruiser.dev/job-instance-id']);

    // If the jobinstance failed without ending up at a known
    // ending state, we will infer the end state based on the
    // pod exit code.
    if (!["finished", "failed"].includes(jobInstance.state)) {
        jobInstance.state =
            pod.status.phase == "Succeeded" ? "finished" :
                "failed";

        await db.merge(jobInstance.id, jobInstance);
    }

    // Cleanup the job now that the log has been persisted
    await k8sBatchApi.deleteNamespacedJob(job.metadata.name, job.metadata.namespace);
    await k8sApi.deleteNamespacedPod(pod.metadata.name, pod.metadata.namespace);

    processJobTriggers(job, jobInstance);
}

const processJobTriggers = async (job: k8s.V1Job, jobInstance: JobInstance) => {
    // TODO: Process triggers for the subsequent jobs

    const isFailure = jobInstance.state == "failed";

    const [pipelineInstance] = await db.select<PipelineInstance>(job.metadata.annotations['cruiser.dev/pipeline-instance-id']);

    const stage = pipelineInstance.spec.stages.find(s => s.id == job.metadata.annotations['cruiser.dev/stage-id']);

    const jobInstances = await db.query<JobInstance[]>(`select * from job_instance where pipeline_instance = '${pipelineInstance.id}'`);

    // Project the job instances into the objects
    jobInstances.forEach(ji => {
        const stage = pipelineInstance.spec.stages.find(s => s.id == ji.stage);

        if (!stage) return;
        stage['_instances'] = stage['_instances'] ?? [];
        stage['_instances'].push(ji);

        const job = stage.jobs.find(j => j.id == jobInstance.job);
        if (!job) return;

        job['_instance'] = ji;
    });

    // Execute all of the webhooks.
    for (const webhook of (stage.webhooks ?? [])) {
        // If the job failed, only execute the webhooks that
        // are configured tp run on failuire.
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
        })
    }

    const stagesToTrigger = pipelineInstance.spec.stages
        .filter(s => s.stageTrigger?.includes(stage.id));

    // TODO: Handle approval triggers
    if (stagesToTrigger.length > 0) {
        // Trigger all of the stages that need to be run.
        for (const stage of stagesToTrigger) {
            if (stage.disabled)
                continue;

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
                })
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
}
