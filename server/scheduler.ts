import * as cron from 'node-cron';
import k8s from '@kubernetes/client-node';
import { ulid } from "ulidx";
import { getLogger } from './util';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.BatchV1Api);

const namespace = "dotops";
const workerImage = "dotops-agent:latest";
const maxAgentLifetimeSeconds = 1000;

const logger = getLogger("scheduler");

// Check for new jobs every 5 seconds
const jobExecutionPlanPollInterval = 5 * 1000;

type JobExecutionPlan = {
    id: number,
    lastUpdated: string,
    // ...
};

const execPlans: { [key: string]: JobExecutionPlan; } = {};
const tasks: { [key: string]: cron.ScheduledTask; } = {};
const jobs: { [key: string]: k8s.V1Job; } = {};

export const Scheduler = async () => {
    logger.info("Initializing");

    setInterval(async () => {
        logger.info("Loading Execution Plans");


        logger.info("Loaded execution plans", { count: jobExecutionPlans.length });


        for (let i = 0; i < jobExecutionPlans.length; i++) {
            const execPlan = jobExecutionPlans[i];

            if (tasks[execPlan.id]) {
                // The task already exists.
            }
            else {

                logger.info("Found new execution plan", execPlan);

                if (!cron.validate(execPlan.cron)) {
                    logger.warn(`Execution plan ${execPlan.id} has invalid CRONTAB. Skipping.`);
                    continue;
                }

                logger.info(`Scheduling plan ${execPlan.id} based on crontab`, { cron: execPlan.cron });
                // Add a new cron task to the listener
                const task = cron.schedule(execPlan.cron, async () => {
                    logger.info(`CRON timer invoking execution of Plan ${execPlan.id}`, execPlan);

                    const jobId = ulid();
                    execPlan['_ulid'] = jobId;

                    logger.info(`Creating Job for plan ${execPlan.id}...`, execPlan);

                    const res = await k8sApi.createNamespacedJob(namespace, {
                        apiVersion: "v1",
                        kind: "Job",
                        metadata: {
                            name: `eric-worker-${jobId}`,
                            annotations: {
                                "cronjob.kubernetes.io/instantiate": "manual"
                            }
                        },
                        spec: {
                            activeDeadlineSeconds: maxAgentLifetimeSeconds,
                            template: {
                                spec: {
                                    containers: [
                                        {
                                            name: `eric-worker-${jobId}`,
                                            image: workerImage,
                                            imagePullPolicy: "IfNotPresent"
                                        }
                                    ],
                                    restartPolicy: 'Never'
                                }
                            }
                        }
                    }).catch(err => {
                        logger.error(`Failed to create Job for plan ${execPlan.id}`, err);
                        return null;
                    });

                    const job = res?.body;

                    // Failed to create a job.
                    if (!job) {
                        return;
                    }

                    logger.info(`Successfully created Job`, job);

                    job['_execPlan'] = execPlan;
                    jobs[jobId] = job;
                });

                execPlans[execPlan.id] = execPlan;
                tasks[execPlan.id] = task;
                task.start();
            }
        }

    }, jobExecutionPlanPollInterval);
};
