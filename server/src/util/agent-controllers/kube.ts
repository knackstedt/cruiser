import fs from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { JobInstance } from '../../types/agent-task';
import { logger } from '../logger';
import { environment } from '../environment';
import { db } from '../db';
import { AgentInitializer } from './interface';
import { StringRecordId } from 'surrealdb';


const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sWatch = new k8s.Watch(kc);

const flushInterval = 30000;

export class KubeAgent implements AgentInitializer {
    async spawn(
        pipelineInstance: PipelineInstance,
        pipeline: PipelineDefinition,
        stage: StageDefinition,
        jobDefinition: JobDefinition,
        jobInstance: JobInstance,
        namespace: string,
        podName: string,
        podId: string,
        kubeAuthnToken: string,
        agentEnvironment: {
            name: string;
            value: string;
        }[]
    ) {
        // TODO: Pass environment variables via a kube secret?

        k8sApi.createNamespacedPod(namespace, {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
                annotations: {
                    "cruiser.dev/created-by": "$cruiser",
                    "cruiser.dev/pipeline-id": pipeline.id,
                    "cruiser.dev/pipeline-label": pipeline.label,
                    "cruiser.dev/pipeline-instance-id": pipelineInstance.id,
                    "cruiser.dev/stage-id": stage.id,
                    "cruiser.dev/stage-label": stage.label,
                    "cruiser.dev/job-id": jobDefinition.id,
                    "cruiser.dev/job-label": jobDefinition.label,
                    "cruiser.dev/job-instance-id": jobInstance.id,
                    ...jobDefinition?.kubeJobAnnotations
                },
                labels: jobDefinition?.kubeJobLabels,
                name: podName,
            },
            spec: {
                activeDeadlineSeconds: 15 * 60,
                restartPolicy: "Never",
                enableServiceLinks: false,
                // automountServiceAccountToken: false,
                containers: [
                    {
                        name: podName,
                        image: jobDefinition?.kubeContainerImage || "ghcr.io/knackstedt/cruiser/cruiser-agent:latest",
                        imagePullPolicy: 'Always',
                        securityContext: {
                            // Must be true for docker build. Urgh.
                            privileged: true,
                            // allowPrivilegeEscalation: false,
                            // capabilities: {
                            //     drop: ["ALL"]
                            // }
                        },
                        resources: {
                            limits: {
                                cpu: jobDefinition?.kubeCpuLimit || '1000m',
                                memory: jobDefinition?.kubeMemLimit || '4000Mi'
                            },
                            requests: {
                                cpu: jobDefinition?.kubeCpuRequest || '100m',
                                memory: jobDefinition?.kubeMemRequest || '750Mi'
                            }
                        },
                        env: agentEnvironment // Clear any empty env variables
                    }
                ],
                affinity: jobDefinition?.kubeContainerAffinity,
                tolerations: jobDefinition?.kubeContainerTolerations
            }
        })
            .then(({ body }) => body);

        return podName;
    }

    // Connect watchers to the kube api for changes to Pods
    // Cleanup jobs when pods complete, and trigger log storage when a job
    // finishes.
    async watchRunningAgents() {
        const watchPods = () => k8sWatch.watch(`/api/v1/namespaces/${environment.cruiser_kube_namespace}/pods`,
            {},
            (type, apiObj, watchObj) => {
                // TODO: does this cover all cases?
                if (type != 'MODIFIED') return;

                const pod = watchObj.object as k8s.V1Pod;

                // Ensure this is a cruiser-spawned job
                if (pod.metadata.annotations?.['cruiser.dev/created-by'] != "$cruiser")
                    return;


                // This tells us when the pod is done.
                if (pod.status.phase == "Failed" || pod.status.phase == "Succeeded") {
                    this.saveLogAndCleanup(pod);
                }
            },
            (err) => {
                err && console.error(err);
                watchPods();
            }
        );

        watchPods();
        this.sweepPods();
    }

    // In addition to the watchers, we will check every 30 seconds
    // for jobs that may have fallen through the cracks.
    // This helps us handle server restarts without leaving jobs up in the air
    // in a few rare conditions.
    private sweepPods = async() => {
        try {
            const { body: pods } = await k8sApi.listNamespacedPod(environment.cruiser_kube_namespace);

            for (const pod of pods.items) {
                // Ensure we only perform operations on pods we expect to
                if (pod.metadata.annotations?.['cruiser.dev/created-by'] != "$cruiser")
                    continue;

                const isRunning = pod.status.phase == "Running";

                // If the job isn't running, download the entire log & put the pod down
                if (!isRunning) {
                    await this.saveLogAndCleanup(pod);
                }
            }
        }
        catch (ex) {
            logger.error({
                msg: "Error flushing out pods",
                name: ex.name,
                message: ex.message,
                stack: ex.stack
            });
        }

        // Use .bind to prevent call stack overflows
        // setTimeout(this.sweepPods.bind(this), flushInterval);
    }

    // When a job completes, take the log from kube and write it into a log file under storage.
    // TODO: live write the file without bothering with this mess of an API.
    private saveLogAndCleanup = async (pod: k8s.V1Pod) => {
        const { body: log } = await k8sApi.readNamespacedPodLog(pod.metadata.name, pod.metadata.namespace);

        // If the log has this property, it's actually an error (unclear why it's not thrown...)
        if (log['code']) {
            throw log;
        }

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
            log as any instanceof Object ? JSON.stringify(log) : log
        );

        const jobInstance = await db.select<JobInstance>(
            new StringRecordId(pod.metadata.annotations['cruiser.dev/job-instance-id'])
        );

        // If the pod has terminated with any other state than this list, we
        // will infer the correct state to coerce the job into.
        if (jobInstance && !["finished", "failed", "cancelled"].includes(jobInstance.state)) {
            jobInstance.state =
                pod.status.phase == "Succeeded" ? "finished" :
                    "failed";

            await db.merge(new StringRecordId(jobInstance.id), jobInstance);
        }

        // Cleanup the pod now that the log has been stored
        await k8sApi.deleteNamespacedPod(pod.metadata.name, pod.metadata.namespace);
    };
}
