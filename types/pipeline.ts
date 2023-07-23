import { HistoryObject } from 'types/history-object';
import { EnvironmentVariable } from './environment';

export type PipelineArtifact = {
    id: `pipelineArtifact:${string}`
    label: string
    description?: string
    source: string
    destination: string
}

export type PipelineTask = {
    id: `pipelineTask:${string}`;
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
    id: `pipelineTaskGroup:${string}`
    label: string
    description?: string
    order: number
    environment?: EnvironmentVariable[]
    tasks?: PipelineTask[]
}

export type PipelineJob = {
    id: `pipelineJob:${string}`;
    label: string
    description?: string
    elasticAgentId?: string
    order: number
    timeout: string
    runType: string
    invocationCount: number
    failCount: number
    lastRun?: string
    lastTriggerReason?: "cron" | "changes" | "manual" | "webhook"
    runState?: "success" | "fail" | "running"

    taskGroups: PipelineTaskGroup[]
    artifacts: PipelineArtifact[]
    environment?: EnvironmentVariable[]
}

export type PipelineStage = {
    id: `pipelineStage:${string}`
    label: string
    description?: string
    lastRunState?: string
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
    id: `pipelineSource:${string}`
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
    id: `pipeline:${string}`
    label: string
    description: string
    labelTemplate: string
    state: "locked" | "paused" | "active"
    lockingBehavior: "singleton" | "singletonNoFail" | "multiple"
    group: string
    isTemplate: boolean
    // record id for the pipeline's template
    pipelineTemplate: string,
    // If the pipeline is a clone so a user can edit and save
    // it all at once
    isUserEditInstance: boolean,
    automaticScheduling: boolean

    cronSchedule: string
    cronRunOnlyOnNewSource: boolean

    trackingToolPattern: string
    trackingToolUri: string

    order: number
    stages?: PipelineStage[]
    environment?: EnvironmentVariable[]
    sources?: PipelineSource[],
    history?: HistoryObject[]
}
