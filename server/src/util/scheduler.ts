import * as k8s from '@kubernetes/client-node';
import { db } from './db';
import { JobInstance } from '../../types/agent-task';
import { getLogger } from './logger';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const namespace = "cruiser";
const workerImage = "cruiser-agent:latest";
const maxAgentLifetimeSeconds = 1000;

const logger = getLogger("scheduler");

// Check for new jobs every 5 seconds
const jobExecutionPlanPollInterval = 5 * 1000;



export const Scheduler = async () => {
    logger.info("Initializing");

    setInterval(async () => {
        logger.info("Loading queued jobs");
        const jobs = await db.select("jobInstance") as JobInstance[];
        const pendingJobs = jobs.filter(j => j.state == "pending");

        logger.info("Loaded execution plans", { count: jobs.length });


        for (let i = 0; i < jobs.length; i++) {
            const jobInstance = jobs[i];
            const job = jobInstance.job;
            const [elasticAgent] = await db.select(`elasticAgentPool:${job.elasticAgentId}`) as any[];

            const environment: { key: string, value: string; }[] =
                await db.query(`RETURN fn::job_get_environment(${job.id})`) as any;

            const namespace = jobInstance.kubeNamespace || elasticAgent.kubeContainerImage || "cruiser";
            k8sApi.createNamespacedPod(namespace, {
                apiVersion: "v1",
                kind: "pod",
                metadata: {
                    name: "cruiser-" + jobInstance.id.split(':')[1],
                    labels: {

                    }
                },
                spec: {
                    containers: [{
                        name: "cruiser-agent",
                        image: elasticAgent.kubeContainerImage,
                        env: environment.map(e => ({ name: e.key, value: e.value }))
                    }]
                }
            });


        }

    }, jobExecutionPlanPollInterval);
};
