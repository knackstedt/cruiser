import fs, { stat } from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import { logger } from '../util/logger';
import { db } from '../util/db';
import { JobInstance } from '../types/agent-task';
import { environment } from '../util/environment';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sWatch = new k8s.Watch(kc);

// Connect "watchers" to the kube api for changes to Pods and Jobs
// Cleanup jobs when pods complete, and trigger log storage when a job
// finishes.
export const WatchAndFlushJobs = async() => {
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


            // This tells us when the job is done.
            if (pod.status.phase == "Failed" || pod.status.phase == "Succeeded") {
                SaveLogAndCleanup(pod);
            }
        },
        (err) => {
            err && console.error(err);
            watchPods();
        }
    )


    watchPods();
    SweepPods();
};

// In addition to the watchers, we will check every 30 seconds
// for jobs that may have fallen through the cracks.
// This helps us handle server restarts without leaving jobs up in the air
// in a few rare conditions.
const flushInterval = 30000;
const SweepPods = async () => {
    try {
        const { body: pods } = await k8sApi.listNamespacedPod(environment.cruiser_kube_namespace);

        for (const pod of pods.items) {
            // Ensure we only perform operations on pods we expect to
            if (pod.metadata.annotations?.['cruiser.dev/created-by'] != "$cruiser")
                continue;

            const isRunning = pod.status.phase == "Running";

            // If the job isn't running, download the entire log & put the pod down
            if (!isRunning) {
                await SaveLogAndCleanup(pod);
            }
        }
    }
    catch(ex) {
        logger.error({
            msg: "Error flushing out pods",
            name: ex.name,
            message: ex.message,
            stack: ex.stack
        })
    }

    // Use .bind to prevent call stack overflows
    setTimeout(SweepPods.bind(this), flushInterval);
}

// When a job completes, take the log from kube and write it into a log file under storage.
// TODO: live write the file without bothering with this mess of an API.
const SaveLogAndCleanup = async (pod: k8s.V1Pod) => {
    const log = '...';

    const dir = [
        environment.cruiser_log_dir,
        pod.metadata.annotations['cruiser.dev/pipeline-id'],
        pod.metadata.annotations['cruiser.dev/pipeline-instance-id'],
        pod.metadata.annotations['cruiser.dev/stage-id'],
        pod.metadata.annotations['cruiser.dev/job-id'],
    ].join('/');

    // Write the file to disk.
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
        dir + '/' + pod.metadata.annotations['cruiser.dev/job-instance-id'] + ".log",
        log
    );

    const [jobInstance] = await db.select<JobInstance>(pod.metadata.annotations['cruiser.dev/job-instance-id']);

    // If the pod has terminated with any other state than this list, we
    // will infer the correct state to coerce the job into.
    if (jobInstance && !["finished", "failed", "cancelled"].includes(jobInstance.state)) {
        jobInstance.state =
            pod.status.phase == "Succeeded" ? "finished" :
                "failed";

        // Ensure that the end time has been set by now.
        jobInstance.endEpoch ??= Date.now();
        await db.merge(jobInstance.id, jobInstance);
    }

    // Cleanup the pod now that the log has been stored
    await k8sApi.deleteNamespacedPod(pod.metadata.name, pod.metadata.namespace);
}

