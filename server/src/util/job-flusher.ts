import fs, { stat } from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import { logger } from './logger';
import { db } from './db';
import { JobInstance } from '../types/agent-task';
import { environment } from './environment';

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
            if (pod.metadata.annotations['created-by'] != "$cruiser")
                return;

            if (pod.status.phase == "Running") {
                podMap[pod.metadata.annotations['job-instance-id']] = pod;
            }
        },
        (err) => console.error(err)
    )
    const watchJobs = () => k8sWatch.watch(`/apis/batch/v1/namespaces/${environment.cruiser_kube_namespace}/jobs`,
        { },
        async (type, apiObj, watchObj) => {
            if (type != 'MODIFIED') {
                return;
            }

            const job = watchObj.object as k8s.V1Job;

            // Ensure this is a cruiser-spawned job
            if (job.metadata.annotations['created-by'] != "$cruiser")
                return;


            const isComplete = job.status.conditions?.find(c => c.type == "Complete" && c.status);
            const isFailed = job.status.conditions?.find(c => c.type == "Failed" && c.status);
            // const isSuspended = job.status.conditions?.find(c => c.type == "Suspended" && c.status);

            // This tells us when the job is done.
            if (isComplete || isFailed) {
                const pod = podMap[job.metadata.annotations['job-instance-id']];
                podMap[job.metadata.annotations['job-instance-id']] = 0;

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
        (err) => console.error(err)
    );

    watchPods();
    watchJobs();
    SweepJobs();
};

// In addition to the watchers, we will check every 30 seconds
// for jobs that may have fallen through the cracks
// This entire block shouldn't be necessary, but it is left
// in until we know how stable the watchers are.
const flushInterval = 30000;
const SweepJobs = async () => {

    // TODO: jobs with custom namespaces won't be flushed
    const namespace = process.env['CRUISER_AGENT_NAMESPACE'] || "cruiser";

    const { body: result } = await k8sBatchApi.listNamespacedJob(namespace);
    const { body: pods } = await k8sApi.listNamespacedPod(namespace);

    const jobs = result.items;

    for (const job of jobs) {
        // Ensure we only perform operations on pods we expect to
        if (job.metadata.annotations['created-by'] != "$cruiser")
            continue;

        const isRunning = job.status.active > 0;

        // If the job isn't running, download the entire log
        if (!isRunning) {
            const pod = pods.items.find(p => p.metadata.annotations?.['job-id'] == job.metadata.annotations['job-id']);

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
    setTimeout(SweepJobs.bind(this), flushInterval);
}

const SaveLogAndCleanup = async (pod: k8s.V1Pod, job: k8s.V1Job) => {
    const { body: log } = await k8sApi.readNamespacedPodLog(pod.metadata.name, pod.metadata.namespace);

    const dir = [
        environment.cruiser_log_dir,
        job.metadata.annotations['pipeline-id'],
        job.metadata.annotations['stage-id'],
        job.metadata.annotations['job-id'],
    ].join('/');

    // Create the target dir
    await fs.mkdir(dir, { recursive: true });

    // Write the file to disk.
    await fs.writeFile(
        dir + '/' + job.metadata.annotations['job-instance-id'] + ".log",
        log
    );

    const [jobInstance] = await db.select<JobInstance>(job.metadata.annotations['job-instance-id']);

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
}
