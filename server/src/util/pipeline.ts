import { exec } from 'child_process';
import { ulid } from 'ulidx';
import * as k8s from '@kubernetes/client-node';
import fs from 'fs-extra';

import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { db } from './db';
import { randomString, sleep } from './util';
import { JobInstance } from '../types/agent-task';
import { SetJobToken } from './token-cache';
import { environment } from './environment';
import { logger } from './logger';
import os from 'os';

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

    // If the pipeline as a whole was triggered, run all
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

export const RunStage = async (instance: PipelineInstance, stage: StageDefinition) => {
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

    const results = [];
    for (const job of stage.jobs) {
        const namespace = environment.cruiser_kube_namespace;
        const id = ulid();
        const podId = id.toLowerCase();
        const kubeAuthnToken = randomString(128);
        const podName = `cruiser-ea-${podId}`;

        try {
            SetJobToken(kubeAuthnToken);

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
            const kubeJobMetadata = kubeJob?.metadata;

            await db.merge(jobInstance.id, {
                jobUid: kubeJobMetadata?.uid || "nouid",
            });
        }
        catch(ex) {
            results.push({
                status: 500,
                message: "Failed to start job",
                err: ex
            });
            continue;
        }

        results.push({
            status: 200,
            message: "Started job"
        })
    }

    return results;
}

const createKubeJob = async (
    pipelineInstance: PipelineInstance,
    pipeline: PipelineDefinition,
    stage: StageDefinition,
    jobDefinition: JobDefinition,
    jobInstance: JobInstance,
    namespace: string,
    podName: string,
    podId: string,
    kubeAuthnToken: string
) => {

    // TODO: Add a compendium of standard environment variables
    // https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
    // https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
    // https://developer.harness.io/docs/continuous-integration/troubleshoot-ci/ci-env-var/
    // https://docs.acquia.com/acquia-cloud-platform/features/pipelines/variables
    // https://docs.gocd.org/current/faq/dev_use_current_revision_in_build.html
    // https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
    // https://devopsqa.wordpress.com/2019/11/19/list-of-available-jenkins-environment-variables/
    // https://docs.travis-ci.com/user/environment-variables/
    // https://www.jetbrains.com/help/teamcity/predefined-build-parameters.html#Build+Branch+Parameters
    const envVariables = [
        { name: "CI", value: "true" },
        // { name: "CI_COMMIT_AUTHOR", value: "true" },
        // { name: "CI_COMMIT_BEFORE_SHA", value: "true" },
        // { name: "CI_COMMIT_BRANCH", value: "true" },
        // { name: "CI_COMMIT_DESCRIPTION", value: "true" },
        // { name: "CI_COMMIT_MESSAGE", value: "true" },
        // { name: "CI_COMMIT_REF_NAME", value: "true" },
        // { name: "CI_COMMIT_REF_PROTECTED", value: "true" },
        // { name: "CI_COMMIT_REF_SLUG", value: "true" },
        // { name: "CI_COMMIT_SHA", value: "true" },
        // { name: "CI_COMMIT_SHORT_SHA", value: "true" },
        // { name: "CI_COMMIT_TAG", value: "true" },
        // { name: "CI_COMMIT_TAG_MESSAGE", value: "true" },
        // { name: "CI_COMMIT_TIMESTAMP", value: "true" },
        // { name: "CI_COMMIT_TITLE", value: "true" },
        { name: "CI_ENVIRONMENT", value: "cruiser" },
        // TODO: calculate this value by introspecting the server
        // hostname -i => ip address
        { name: "CRUISER_CLUSTER_URL", value: environment.cruiser_cluster_url },
        { name: "CRUISER_AGENT_ID", value: jobInstance.id.split(':')[1] },
        { name: "CRUISER_SERVER_TOKEN", value: kubeAuthnToken },

        // Provide the otel configuration that the server has
        { name: "OTEL_EXPORTER_OTLP_ENDPOINT", value: process.env['OTEL_EXPORTER_OTLP_ENDPOINT']},

        ...(jobDefinition.environment ?? []),
        ...(stage.environment ?? []),
        ...(pipeline.environment ?? [])
    ].filter(e => !!e.name.trim());

    // If the environment is not on kube, run the agents on the same device.
    // In the future, this should be able to spawn agents elsewhere
    // (other elastic options and static agents)
    // future: should also support settings based on the job
    if (environment.is_running_local_agents) {
        const env = {};
        envVariables.forEach(v => env[v.name] = v.value);

        // TODO: Replace with build dir
        const buildDir = os.tmpdir() + '/cruiser_dev/' + ulid();

        await fs.emptyDir(buildDir);

        let log = '';
        // const proc = exec("ts-node -O '{\"target\": \"esnext\", \"module\": \"commonjs\"}' src/main.ts", {
        const proc = exec("node --nolazy -r ts-node/register src/main.ts", {
            cwd: "../agent",
            env: {
                ...process.env,
                ...env,
                CRUISER_AGENT_BUILD_DIR: buildDir
            },
            windowsHide: true
        });

        proc.stderr.addListener("data", data => log += data);
        proc.stdout.addListener("data", data => log += data);

        proc.on("exit", async code => {
            if (code) {
                logger.error(new Error("Agent process exited with non-zero code " + code));
                await db.merge(jobInstance.id, { status: "failed" });
            }
            else {
                await db.merge(jobInstance.id, { status: "finished" });

                const dir = [
                    environment.cruiser_log_dir,
                    pipeline.id,
                    pipelineInstance.id,
                    stage.id,
                    jobDefinition.id
                ].join('/');

                await fs.mkdir(dir, { recursive: true });

                // Write the file to disk.
                await fs.writeFile(
                    dir + '/' + jobInstance.id + ".log",
                    log
                );
            }
        });
        proc.on("disconnect", () => logger.error(new Error("Agent process disconnected!")));

        return null;
    }
    else {
        return k8sBatchApi.createNamespacedJob(namespace, {
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
                activeDeadlineSeconds: 15 * 60,
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
                        restartPolicy: "Never",
                        enableServiceLinks: false,
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
                                ports: [{ containerPort: 8080 }],
                                env: envVariables // Clear any empty env variables
                            }
                        ],
                        affinity: jobDefinition?.kubeContainerAffinity,
                        tolerations: jobDefinition?.kubeContainerTolerations
                    },
                }
            }
        })
        .then(({body}) => body)
        .catch(err => {
            logger.error({
                msg: err.body?.message || err.message || "unknown error",
                body: err.body
            })
        });
    }
}



