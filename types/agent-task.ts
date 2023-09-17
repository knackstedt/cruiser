import { Pipeline, PipelineJob } from './pipeline';

export type JobInstance = {
    id: string
    label: string
    state:
        "pending"       | // Pending provisioning of job container
        "initializing"  | // Job is just starting up
        "cloning"       | // Job is downloading source
        "building"      | // Job is actively running build code
        "frozen"        | // Job (task group) is frozen
        "sealing"       | // Job is compressing
        "finished"      | // Job has self-completed.
        "complete"      | // Job is finished and acknowledged by scheduler
        "resume";         // A user has resumed a job from the frozen state.
    job: PipelineJob,
    pipeline: Pipeline,
    kubeNamespace: string
    kubePod: string
    queueTime: Date
    startTime: Date
    endTime: Date
    errorCount: number
    warnCount: number
};


export type ElasticAgentConfig = {
    id: string;
    label: string;
    kubeNamespace: string;
    kubeContainerImage: string;
    errorCount: number;
    warnCount: number;
};

export type ElasticAgent = {

}

export type StaticAgentConfig = {

}

export type StaticAgent = {

}
