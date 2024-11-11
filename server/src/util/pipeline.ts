import { ulid } from 'ulidx';

import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../types/pipeline';
import { db } from './db';
import { randomString, sleep } from './util';
import { JobInstance } from '../types/agent-task';
import { SetJobToken } from './token-cache';
import { environment } from './environment';
import { LocalAgent } from './agent-controllers/local';
import { KubeAgent } from './agent-controllers/kube';
import { getAgentEnvironment } from './agent-environment';
import { AgentController } from './agent-controllers/interface';
import { RecordId } from 'surrealdb';



export const RunPipeline = async (
    pipeline: PipelineDefinition,
    user: string,
    triggeredStages?: StageDefinition[]
) => {
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
    const [ instance ] = await db.create<PipelineInstance>("pipeline_instance", {
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
        for (const stage of triggeredStages) {
            if (stage.disabled) continue;

            result.push(await RunStage(instance, stage));
        }

        return result;
    }

    // If the pipeline as a whole was triggered, run all
    // entrypoint stages.
    else {
        let startedStageNum = 0;
        for (const stage of pipeline.stages) {
            if (stage.disabled) continue;
            // Stages with a stage trigger will not automatically be ran
            if (stage.stageTrigger?.length > 0) continue;
            startedStageNum++;

            result.push(await RunStage(instance, stage));
        }
    }

    return result;
}

export const RunStage = async (
    instance: PipelineInstance,
    stage: StageDefinition
) => {
    instance.status.startedStages = instance.status.startedStages ?? [];
    instance.status.startedStages.push(stage.id);

    if (stage.jobs?.length < 1) {
        return (async() => {
            const [jobInstance] = (await db.create<Omit<JobInstance, "id">>(`job_instance`, {
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
        if (job.disabled) continue;

        const namespace = environment.cruiser_kube_namespace;
        const id = ulid();
        const podId = id.toLowerCase();
        const kubeAuthnToken = randomString(128);
        const podName = `cruiser-ea-${podId}`;

        try {
            SetJobToken(kubeAuthnToken);

            const [jobInstance] = (await db.create<Omit<JobInstance, "id">>(new RecordId(`job_instance`, id), {
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

            const kubeJob = await startAgent(
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

const startAgent = async (
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

    const agentEnvironment = getAgentEnvironment(
        pipelineInstance,
        pipeline,
        stage,
        jobDefinition,
        jobInstance,
        namespace,
        podName,
        podId,
        kubeAuthnToken
    );

    // If the environment is not on kube, run the agents on the same device.
    // In the future, this should be able to spawn agents elsewhere
    // (other elastic options and static agents)
    // future: should also support settings based on the job
    AgentController.spawn(
        pipelineInstance,
        pipeline,
        stage,
        jobDefinition,
        jobInstance,
        namespace,
        podName,
        podId,
        kubeAuthnToken,
        agentEnvironment
    );
}



