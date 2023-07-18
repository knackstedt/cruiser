import * as cron from 'node-cron';
import k8s from '@kubernetes/client-node';
import { ulid } from "ulidx";
import { getLogger } from './util';
import { db } from './db';
import { ElasticAgentPool, JobInstance } from '../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const namespace = "dotops";
const workerImage = "dotops-agent:latest";
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
            const [elasticAgent] = await db.select(`elasticAgentPool:${job.elasticAgentId}`) as ElasticAgentPool[];

            const environment: { key: string, value: string; }[] =
                await db.query(`RETURN fn::job_get_environment(${job.id})`) as any;

            k8sApi.createNamespacedPod(jobInstance.kubeNamespace || elasticAgent.kubeContainerImage || namespace, {
                apiVersion: "v1",
                kind: "pod",
                metadata: {
                    name: "dotops-" + jobInstance.id.split(':')[1],
                    labels: {

                    }
                },
                spec: {
                    containers: [{
                        name: "dotops-agent",
                        image: elasticAgent.kubeContainerImage,
                        env: environment.map(e => ({ name: e.key, value: e.value }))
                    }]
                }
            });


        }

    }, jobExecutionPlanPollInterval);
};
