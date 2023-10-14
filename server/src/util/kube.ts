import * as k8s from '@kubernetes/client-node';
import { Pipeline, PipelineJob, PipelineStage } from '../../types/pipeline';
import { db } from './db';
import { JobInstance } from '../../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

export async function StartAgent(pipeline: Pipeline, stage: PipelineStage) {
    return Promise.all(stage.jobs?.map(j => StartAgentJob(pipeline, j)));
}

export async function StartAgentJob(pipeline: Pipeline, job: PipelineJob) {

    if (job.taskGroups?.length < 1) {
        return -1;
    }

    let elasticAgentTemplate: any;
    if (job.elasticAgentId) {
        const [ap] = (await db.query(job.elasticAgentId)) as any as any[];
        elasticAgentTemplate = ap;
    }

    const [ instance ] = (await db.create('jobInstance:ulid()', {
        state: "pending",
        queueTime: new Date().toISOString(),
        errorCount: 0,
        warnCount: 0,
        job: job.id,
        pipeline: pipeline.id
    })) as any as JobInstance[];

    const namespace = elasticAgentTemplate?.kubeNamespace || process.env['AGENT_NAMESPACE'] || "dotops";

    const environment: { name: string, value: string; }[] =
        (await db.query(`RETURN fn::job_get_environment(${job.id})`) as any[])
        .map(({key, value}) => ({name: key, value}))
        .filter(e => e.name != undefined);

    await k8sApi.createNamespace({
        metadata: {
            name: namespace
        }
    }).catch(e => {
        if (e.body.reason != 'AlreadyExists')
            throw e;
    });

    const [table, id] = instance.id.split(':');
    const ulid = id.toLowerCase();

    const result = await k8sApi.createNamespacedPod(namespace, {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            annotations: elasticAgentTemplate?.kubeContainerAnnotations,
            labels: elasticAgentTemplate?.kubeContainerLabels,
            name: `dotops-ea-${ulid}`,
        },
        spec: {
            tolerations: elasticAgentTemplate?.kubeContainerTolerations,
            containers: [
                {
                    name: `dotops-ea-${ulid}`,
                    image: elasticAgentTemplate?.kubeContainerImage || "ghcr.io/knackstedt/dot-ops/dotops-agent:6da73dfc68c9a38277ca780e83098e321c2844ca",
                    imagePullPolicy: 'IfNotPresent',
                    securityContext: {
                        privileged: true
                    },
                    resources: {
                        limits: {
                            cpu: elasticAgentTemplate?.kubeCpuLimit,
                            memory: elasticAgentTemplate?.kubeMemLimit
                        },
                        requests: {
                            cpu: elasticAgentTemplate?.kubeCpuRequest,
                            memory: elasticAgentTemplate?.kubeMemRequest
                        }
                    },
                    env: [
                        // TODO: pass surreal connection string
                        // consider using HTTP POST instead.
                        { name: "CI_ENVIRONMENT", value: "dotops" },
                        { name: "DOTGLITCH_AGENT_ID", value: instance.id.split(':')[1] },
                        { name: "SURREAL_URL", value: 'http://192.168.1.159:8000' },
                        ...environment
                    ]
                }
            ]
        }
    });
    const pod = result.body;

    await db.merge(instance.id, {
        kubepod: pod.metadata.uid
    });
    return 1;
}
