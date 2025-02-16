import { HistoryObject } from './history-object';
import { EnvironmentVariable } from './environment';

export type InputArtifact = {
    id: string
    label: string
    description?: string

    job: string,
    sourceArtifact: string,
    destination: string
}

export type OutputArtifact = {
    id: string
    label: string
    description?: string
    source: string
    destination: string,
    compressionAlgorithm?: "lrzip" | "gzip" | "zip" | "zstd" | "zstd_max" | "bzip" | "plzip" | "plzip_max" | "xz" | "xz_max";
}

export type PipelineTask = {
    id: string;
    label: string
    disabled: boolean,
    timeout: number
    order: number
    description?: string
    cwd?: string
    kind?: string // default 'command'

    breakBeforeTask: boolean
    breakAfterTask: boolean
    breakOnTaskFailure: boolean
    breakOnTaskSuccess: boolean

    maxRetryAttempts: number
    retryOnTaskFailure: boolean
    abortGroupOnTaskFailure: boolean

    branchFilter?: string[]

    environment?: EnvironmentVariable[]

    // Id of the agent container script the task will run
    // defaults to `command`
    taskScriptId: string
    // For task scripts that have more than 1 command, enable
    // specifying the command to execute
    taskScriptSubId: string
    // Arguments to be fed into the specified task script.
    taskScriptArguments: Object
}

export type PipelineTaskGroup = {
    id: string
    label: string
    description?: string
    order: number
    disabled?: boolean


    environment?: EnvironmentVariable[]
    tasks?: PipelineTask[],
    preTaskGroups?: string[],
    branchFilter?: string[]
}

export type PipelineJobDefinition = {
    id: string;
    label: string
    description?: string
    order: number
    disabled?: boolean

    jobInstance?: string,

    elasticAgentId?: string
    timeout?: string
    lastRun?: string
    lastTriggerReason?: "cron" | "changes" | "manual" | "webhook"
    runState?: "success" | "fail" | "running"

    branchFilter?: string[]

    taskGroups: PipelineTaskGroup[]
    inputArtifacts?: InputArtifact[]
    outputArtifacts?: OutputArtifact[]
    environment?: EnvironmentVariable[]

    kubeNamespace?: string,
    kubeJobAnnotations?: { [key: string]: string },
    kubeJobLabels?: { [key: string]: string },
    kubeContainerTolerations?: any[];
    kubeContainerAffinity?: any;
    kubeContainerAnnotations?: { [key: string]: string },
    kubeContainerLabels?: { [key: string]: string },
    kubeContainerImage?: string,
    kubeCpuLimit?: string;
    kubeMemLimit?: string;
    kubeCpuRequest?: string;
    kubeMemRequest?: string;

    platform?: `agent_${string}` | 'agentless' | `kube_${string}`
}

export type Webhook = {
    id: string,
    label: string,
    description?: string,
    disabled?: boolean

    url?: string,
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    headers?: [string, string][],
    body?: string,
    proxy?: {
        host: string;
        port: number;
        auth?: {
            username: string;
            password: string;
        };
        protocol?: string;
    };

    // For the webhook instance, we will set state
    state?: "success" | "fail";

    executeOnFailure?: boolean
}

export type PipelineStage = {
    id: string
    renderMode: "normal" | "gateway" | "job_container"
    label: string
    description?: string
    lastRunState?: string
    order: number
    onlyOnPreviousSuccess?: boolean
    cleanupArtifacts?: boolean
    cleanDirectory?: boolean
    autoTriggerOnPreviousStageCompletion?: boolean
    environment?: EnvironmentVariable[]
    jobs?: PipelineJobDefinition[],
    disabled?: boolean

    sources?: PipelineSource[];

    stageTrigger?: string[]
    cronTrigger?: string,
    cronExcludeAuto?: boolean,
    approvalUsers?: string[], // users who may approve the pipeline
    requiredApprovals?: number, // number of approvals before it may be normally run
    webhooks?: Webhook[];
    runCount?: number;

    executeOnFailure?: boolean;
    branchFilter?: string[]
}

export type PipelineSource = Partial<{
    id: string
    label: string
    description: string
    targetPath: string
    disabled: boolean
    type: "git" | "svn" | "tfs"

    branch: string
    branchFilter?: string[]

    username: string
    password: string
    cloneDepth: number
    disablePolling: boolean

    lastHash: string,

    pollingBehavior: string
    pollForUpdates: boolean,
    pollIntervalSeconds: number,

    denyList: string
    invertFilter: boolean

    url: string

    // A map of the last valid hash and which branch ref it points to
    lastGitHash: {
        [key: string]: string
    }

    // ... This should be revisited
    pipelines: PipelineDefinition[]
}>


export type PipelineDefinition = {
    id: string
    label: string
    description: string
    labelTemplate: string
    state: "new" | "locked" | "paused" | "active"
    lockingBehavior: "singleton" | "singletonNoFail" | "multiple"
    group: string
    isTemplate: boolean
    kind: "build" | "release"
    deleted?: boolean

    // record id for the pipeline's template
    pipelineTemplate: string,
    // If the pipeline is a clone so a user can edit and save
    // it all at once
    _isUserEditInstance: boolean,
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

export type PipelineInstance = {
    id: string,
    identifier: string,
    spec: PipelineDefinition,
    metadata: unknown,
    status: {
        phase: "started" | "running" | "stopped" | "waiting" | "failed" | "cancelled",
        startEpoch: number,
        jobInstances: string[]
        startedStages: string[],
        finishedStages: string[],
        failedStages: string[],
        endEpoch?: number,
        stageApprovals?: {
            stageId: string,
            approvalCount: number,
            readyForApproval: boolean,
            approvers: string[],
            hasRun: boolean
        }[]
    },
    stats: {
        successfulTaskCount: number;
        failedTaskCount: number;
        totalRuntime: number;
    }
}
