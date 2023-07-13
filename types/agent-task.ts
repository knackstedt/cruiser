import { PipelineJob } from './pipeline';

export type AgentJob = {
    label: string,
    state:
        "pending"       | // Pending provisioning of job container
        "initializing"  | // Job is just starting up
        "cloning"       | // Job is downloading source
        "building"      | // Job is actively running build code
        "frozen"        | // Job (task group) is frozen
        "sealing"       | // Job is compressing
        "finished"      | // Job has self-completed.
        "complete"      | // Job is finished and acknowledged by scheduler
        "resume";         // A user has resumed a job from being frozen.
    job: PipelineJob
};
