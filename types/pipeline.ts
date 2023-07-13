import { EnvironmentVariable } from './environment';

export type PipelineArtifact = {
    label: string
    description?: string
    source: string
    destination: string
}

export type PipelineTask = {
    command: string
    arguments: string[]
    commandTimeout: number
    label: string
    description?: string
    workingDirectory?: string
    order: number
    runIfPreviousTaskPassed: boolean
    runIfPreviousTaskFailed: boolean
    freezeBeforeRun: boolean
    freezeAfterRun: boolean
    taskOnSelfFailure: PipelineTask
    environment?: EnvironmentVariable[]
}

export type PipelineTaskGroup = {
    label: string
    description?: string
    order: number
    environment?: EnvironmentVariable[]
    tasks?: PipelineTask[]
}

export type PipelineJob = {
    label: string
    description?: string
    elasticAgentId?: string
    order: number
    timeout: string
    runType: string

    taskGroups: PipelineTaskGroup[]
    artifacts: PipelineArtifact[]
    environment?: EnvironmentVariable[]
}

export type PipelineStage = {
    label: string
    description?: string
    order: number
    onlyOnPreviousSuccess?: boolean
    fetchSources?: boolean
    cleanupArtifacts?: boolean
    cleanDirectory?: boolean
    autoTriggerOnPreviousStageCompletion?: boolean
    environment?: EnvironmentVariable[]
    jobs?: PipelineJob[]
}

export type PipelineSource = {
    label: string
    description: string
    targetPath: string
    type: "git" | "svn" | "tfs"

    branch: string
    username: string
    password: string
    cloneDepth: number
    pollingBehavior: string

    denyList: string
    invertFilter: boolean

    url: string
    pipelines: Pipeline[]
}


export type Pipeline = {
    label: string
    description: string
    labelTemplate: string
    state: "locked" | "paused" | "active"
    lockingBehavior: "singleton" | "singletonNoFail" | "multiple"
    group: string

    automaticScheduling: boolean

    cronSchedule: string
    cronRunOnlyOnNewSource: boolean

    trackingToolPattern: string
    trackingToolUri: string

    order: number
    stages: PipelineStage[]
    environment?: EnvironmentVariable[]
    sources: PipelineSource[]
}
