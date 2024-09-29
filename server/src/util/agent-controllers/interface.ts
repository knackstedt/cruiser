import { JobInstance } from '../../types/agent-task';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { environment } from '../environment';
import { KubeAgent } from './kube';
import { LocalAgent } from './local';

export interface AgentInitializer {
    spawn(
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
    ): Promise<string>;

    watchRunningAgents(): Promise<unknown>;
}

export const AgentController: AgentInitializer =
    environment.is_running_local_agents
        ? new LocalAgent()
        : new KubeAgent();
