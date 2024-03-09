import { HistoryObject } from './history-object';
import { EnvironmentVariable } from './environment';

export type BuildArtifact = {
    id: `pipelineArtifact:${string}`
    label: string
    description?: string
    source: string
    destination: string
}

export type TaskDefinition = {
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
    preBreakpoint: boolean
    postBreakpoint: boolean
    disableErrorBreakpoint: boolean
    taskOnSelfFailure: TaskDefinition
    environment?: EnvironmentVariable[]
}

export type TaskGroupDefinition = {
    id: `pipelineTaskGroup:${string}`
    label: string
    description?: string
    order: number
    environment?: EnvironmentVariable[]
    tasks?: TaskDefinition[]
}

export type JobDefinition = {
    id: `pipelineJob:${string}`;
    label: string
    description?: string
    elasticAgentId?: string
    order: number
    timeout: string
    runType: string
    lastRun?: string
    lastTriggerReason?: "cron" | "changes" | "manual" | "webhook"
    runState?: "success" | "fail" | "running"

    taskGroups: TaskGroupDefinition[]
    artifacts: BuildArtifact[]
    environment?: EnvironmentVariable[]

    runCount: number,
    invocationCount: number
    failCount: number
}

export type StageDefinition = {
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
    jobs?: JobDefinition[]
}

export type SourceConfiguration = Partial<{
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
    pipelines: PipelineDefinition[]
}>


export type PipelineDefinition = {
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
    stages?: StageDefinition[]
    environment?: EnvironmentVariable[]
    sources?: SourceConfiguration[],
    history?: HistoryObject[]

    lastScheduledEpoch?: number,
    lastScheduledBy?: string

    stats?: {
        runCount: number,
        successCount: number,
        failCount: number,

        // ms
        totalRuntime: number
    }
}
