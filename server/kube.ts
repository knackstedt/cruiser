import k8s from '@kubernetes/client-node';
import { PipelineJob, PipelineStage } from '../types/pipeline';
import { db } from './db';
import { ElasticAgentPool, JobInstance } from '../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const namespace = process.env['AGENT_NAMESPACE'] || "dotglitch-dotops";


export async function StartAgent(stage: PipelineStage) {
    return Promise.all(stage.jobs.map(j => StartAgentJob(j)));
}

export async function StartAgentJob(job: PipelineJob) {

    let elasticAgentPool: ElasticAgentPool;
    if (job.elasticAgentId) {
        const [ap] = (await db.query('SELECT * from ')) as any as ElasticAgentPool[];
        elasticAgentPool = ap;
    }


    const [instance] = (await db.create('jobInstance:ulid()', {
        state: "pending",
        queueTime: new Date().toISOString(),
        errorCount: 0,
        warnCount: 0,
        job: job.id,
    })) as any as JobInstance[];

    const result = await k8sApi.createNamespacedPod(namespace, {
        apiVersion: "v1",
        kind: "pod",
        metadata: {

        },
        spec: {
            containers: [
                {
                    name: `dotops-ea-${instance.id}`,
                    image: elasticAgentPool.kubeContainerImage,
                    imagePullPolicy: 'ifNotPresent'
                }
            ]
        }
    });
    const pod = result.body;


    await db.merge(instance.id, { kubepod: pod.metadata.uid })
}
