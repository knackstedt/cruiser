export type JobInstance = {
    id: string
    state:
        "queued"        | // Pending provisioning of job container
        "preflight"     | // Agent is ensuring all dependencies are available
        "initializing"  | // Job is just starting up
        "cloning"       | // Job is downloading source
        "building"      | // Job is actively running build code
        "frozen"        | // Job (task group) is frozen
        "sealing"       | // Job is compressing
        "finished"      | // Job is finished and acknowledged by scheduler
        "failed"
    pipeline: string,
    pipeline_instance: string,
    job: string,
    jobUid: string
    stage?: string,
    kubeNamespace?: string
    kubePodName?: string
    kubeAuthnToken?: string,

    breakpointTask?: string,
    breakpointTaskGroup?: string,

    queueEpoch: number
    initEpoch?: number
    cloneEpoch?: number
    buildEpoch?: number
    uploadEpoch?: number
    endEpoch?: number

    errorCount?: number
    warnCount?: number
};

