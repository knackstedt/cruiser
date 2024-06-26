import { ulid } from 'ulidx';
import * as k8s from '@kubernetes/client-node';

import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { db } from './db';
import { randomString } from './util';
import { JobInstance } from '../types/agent-task';
import { SetJobToken } from './token-cache';
import { environment } from './environment';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);


export const RunPipeline = async (pipeline: PipelineDefinition, user: string, triggeredStages?: StageDefinition[]) => {

    // If the pipeline has no stages, we'll simply exit.
    if (!pipeline.stages?.[0]) {
        return {
            status: 409,
            message: "Cannot start: pipeline doesn't have any stages to run."
        };
    }

    // Default stats
    pipeline.stats = pipeline.stats || {
        runCount: 0,
        successCount: 0,
        failCount: 0,
        totalRuntime: 0
    };

    pipeline.stats.runCount += 1;
    pipeline.lastScheduledEpoch = Date.now();
    pipeline.lastScheduledBy = user;

    // Update the pipeline definition stats
    await db.merge(pipeline.id, pipeline);

    // TODO: Add custom logic for calculating release id
    const [ qResult ] = await db.query(`select count() from pipeline_instance where spec.id = '${pipeline.id}' group all`);
    const { count } = qResult[0] ?? {};

    // Create a pipeline instance for this run
    // Load in a soft clone of the pipeline so we know what the current release
    // instance needs to run from
    const [ instance ] = await db.create<PipelineInstance>("pipeline_instance:ulid()", {
        spec: pipeline,
        identifier: (count || 1).toString(),
        metadata: {
            "$triggered_by": user,
            "$trigger_stages": triggeredStages?.map(ts => ts.id).join(',')
        },
        stats: {
            successfulTaskCount: 0,
            failedTaskCount: 0
        },
        status: {
            phase: "started",
            startEpoch: Date.now(),
            jobInstances: [],
            startedStages: [],
            finishedStages: []
        }
    } as PipelineInstance);


    const result = [];

    // If this was triggered by a git change, we only want
    // to run the specific stage flow that's required
    if (triggeredStages) {
        for (const stage of triggeredStages)
            result.push(await RunStage(instance, stage));

        return result;
    }
    // If the pipeline as a whole was triggered, run all of the
    // entrypoint stages.
    else {
        let startedStageNum = 0;
        for (const stage of pipeline.stages) {
            // Stages with a stage trigger will not automatically be ran
            if (stage.stageTrigger?.length > 0) continue;
            startedStageNum++;

            result.push(await RunStage(instance, stage));
        }
    }

    return result;
}

export const RunStage = (instance: PipelineInstance, stage: StageDefinition) => {
    instance.status.startedStages = instance.status.startedStages ?? [];
    instance.status.startedStages.push(stage.id);

    if (stage.jobs?.length < 1) {
        return (async() => {
            const [jobInstance] = (await db.create<Omit<JobInstance, "id">>(`job_instance:ulid()`, {
                state: "finished",
                queueEpoch: Date.now(),
                endEpoch: Date.now(),
                jobUid: null,
                job: null,
                pipeline: instance.spec.id,
                pipeline_instance: instance.id,
                stage: stage.id
            })) as any as JobInstance[];

            instance.status.jobInstances = instance.status.jobInstances ?? [];
            instance.status.jobInstances.push(jobInstance.id);

            await db.merge(instance.id, instance);

            return {
                status: 409,
                message: "Skipping: Stage doesn't have any jobs to run."
            };
        })();
    }

    return stage.jobs.map(async job => {
        const namespace = environment.cruiser_kube_namespace;
        const id = ulid();
        const podId = id.toLowerCase();
        const kubeAuthnToken = randomString(128);
        const podName = `cruiser-ea-${podId}`;

        try {
            SetJobToken(kubeAuthnToken);

            // await db.query(`UPDATE job_instance SET latest = false WHERE job.id = '${job.id}'`);

            const [jobInstance] = (await db.create<Omit<JobInstance, "id">>(`job_instance:${id}`, {
                state: "queued",
                queueEpoch: Date.now(),
                errorCount: 0,
                warnCount: 0,
                job: job.id,
                jobUid: id,
                pipeline: instance.spec.id,
                pipeline_instance: instance.id,
                stage: stage.id,
                kubeNamespace: namespace,
                kubePodName: podName,
                kubeAuthnToken
            })) as any as JobInstance[];

            job.jobInstance = jobInstance.id;

            instance.status.jobInstances = instance.status.jobInstances ?? [];
            instance.status.jobInstances.push(jobInstance.id);
            await db.merge(instance.id, instance);

            const kubeJob = await createKubeJob(
                instance,
                instance.spec,
                stage,
                job,
                jobInstance,
                namespace,
                podName,
                podId,
                kubeAuthnToken
            );

            // @ts-ignore
            const kubeJobMetadata = kubeJob.metadata;

            await db.merge(jobInstance.id, {
                jobUid: kubeJobMetadata.uid,
            });
        }
        catch(ex) {
            return {
                status: 500,
                message: "Failed to start job",
                err: ex
            }
        }

        return {
            status: 200,
            message: "Started job"
        }
    })
}

const createKubeJob = (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    jobDefinition: JobDefinition,
    jobInstance: JobInstance,
    namespace: string,
    podName: string,
    podId: string,
    kubeAuthnToken: string
) =>
    k8sBatchApi.createNamespacedJob(namespace, {
        apiVersion: "batch/v1",
        kind: "Job",
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
            activeDeadlineSeconds: Number.MAX_SAFE_INTEGER,
            template: {
                metadata: {
                    annotations: {
                        "cruiser.dev/created-by": "$cruiser",
                        "cruiser.dev/release": pipelineInstance.identifier,
                        "cruiser.dev/pipeline-id": pipeline.id,
                        "cruiser.dev/pipeline-label": pipeline.label,
                        "cruiser.dev/pipeline-instance-id": pipelineInstance.id,
                        "cruiser.dev/stage-id": stage.id,
                        "cruiser.dev/stage-label": stage.label,
                        "cruiser.dev/job-id": jobDefinition.id,
                        "cruiser.dev/job-label": jobDefinition.label,
                        "cruiser.dev/job-instance-id": jobInstance.id,
                        ...jobDefinition?.kubeContainerAnnotations
                    },
                    labels: jobDefinition?.kubeContainerLabels,
                },
                spec: {
                    tolerations: jobDefinition?.kubeContainerTolerations,
                    restartPolicy: "Never",
                    enableServiceLinks: false,
                    containers: [
                        {
                            name: podName,
                            image: jobDefinition?.kubeContainerImage || "ghcr.io/knackstedt/cruiser/cruiser-agent:latest",
                            imagePullPolicy: 'Always',
                            securityContext: {
                                // Must be true for docker build
                                privileged: true,
                                capabilities: {
                                    drop: ["ALL"]
                                }
                            },
                            resources: {
                                limits: {
                                    cpu: jobDefinition?.kubeCpuLimit,
                                    memory: jobDefinition?.kubeMemLimit
                                },
                                requests: {
                                    cpu: jobDefinition?.kubeCpuRequest,
                                    memory: jobDefinition?.kubeMemRequest
                                }
                            },
                            ports: [{ containerPort: 8080 }],
                            env: [
                                { name: "CI_ENVIRONMENT", value: "cruiser" },
                                // TODO: calculate this value by introspecting the server
                                // hostname -i => ip address
                                { name: "CRUISER_CLUSTER_URL", value: environment.cruiser_cluster_url },
                                { name: "CRUISER_AGENT_ID", value: jobInstance.id.split(':')[1] },
                                { name: "CRUISER_SERVER_TOKEN", value: kubeAuthnToken },
                                ...(jobDefinition.environment ?? []),
                                ...(stage.environment ?? []),
                                ...(pipeline.environment ?? [])
                            ].filter(e => !!e.name.trim()) // Clear any empty env variables
                        }
                    ]
                }
            }
        }
    })
    .then(({body}) => body)
    .catch(err => {
        debugger;
    });

