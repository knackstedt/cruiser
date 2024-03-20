import fs, { stat } from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import { logger } from './logger';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
const k8sLog = new k8s.Log(kc);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

let logStore = process.env['CRUISER_BLOBSTORE_PATH'] ?? __dirname + "../../../../data/log";
if (!logStore.endsWith('/')) logStore += '/';
fs.mkdirSync(logStore, { recursive: true });

// Flush jobs every 30 seconds
const flushInterval = parseInt(process.env['CRUISER_JOB_FLUSH_INTERVAL'] || "30000");
export const WatchAndFlushJobs = async () => {

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
            const jobPod = pods.items.find(p => p.metadata.annotations?.['job-id'] == job.metadata.annotations['job-id']);

            if (!jobPod) {
                logger.warn({
                    msg: "Completed job pod has been removed prematurely.",
                    job
                });
                continue;
            }

            const { body: log } = await k8sApi.readNamespacedPodLog(jobPod.metadata.name, namespace);

            const dir = [
                logStore,
                job.metadata.annotations['pipeline-id'],
                job.metadata.annotations['stage-id'],
            ].join('/');

            // Create the target dir
            await fs.mkdir(dir, { recursive: true });

            // Write the file to disk.
            await fs.writeFile(
                dir + '/' + job.metadata.annotations['job-id'] + ".log",
                log
            );

            // Cleanup the job now that the log has been persisted
            await k8sBatchApi.deleteNamespacedJob(job.metadata.name, job.metadata.namespace);

            // const req = await k8sLog.log(namespace, jobPod.metadata.name, podName, {}, {
            //     follow: true,
            //     pretty: false,
            //     timestamps: false,
            // });
        }
    }

    setTimeout(WatchAndFlushJobs.bind(this), flushInterval);
}
