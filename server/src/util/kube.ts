import * as k8s from '@kubernetes/client-node';
import { PipelineJob, PipelineStage } from '../../types/pipeline';
import { db } from './db';
import { JobInstance } from '../../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


export async function StartAgent(stage: PipelineStage) {
    return Promise.all(stage.jobs?.map(j => StartAgentJob(j)));
}

export async function StartAgentJob(job: PipelineJob) {
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
                    image: elasticAgentTemplate?.kubeContainerImage || "ghcr.io/knackstedt/dot-ops/dotops-agent:84657a25297a5709cea4d29dea78d5df13376e5d",
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
                        { name: "DOTGLITCH_JOB_ID", value: instance.id },
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
