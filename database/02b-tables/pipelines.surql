DEFINE TABLE pipelineArtifacts SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineTasks TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineTasks TYPE string;
    DEFINE FIELD source ON TABLE pipelineTasks TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD destination ON TABLE pipelineTasks TYPE string
        ASSERT $value != NONE;


DEFINE TABLE pipelineTasks SCHEMAFULL;
    DEFINE FIELD command ON TABLE pipelineTasks TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD label ON TABLE pipelineTasks TYPE string;
    DEFINE FIELD description ON TABLE pipelineTasks TYPE string;
    DEFINE FIELD workingDirectory ON TABLE pipelineTasks TYPE string;
    -- True by default
    DEFINE FIELD runIfPreviousTaskPassed ON TABLE pipelineTasks TYPE string
        VALUE $value OR true;
    DEFINE FIELD runIfPreviousTaskFailed ON TABLE pipelineTasks TYPE string
        VALUE $value OR false;
    -- A task to run when this task fails or is cancelled
    DEFINE FIELD taskOnSelfFailure ON TABLE pipelineTasks TYPE record(pipelineTasks);
    DEFINE FIELD environmentVariables.* ON TABLE pipelineStages TYPE record(environmentVariables);


DEFINE TABLE pipelineJobs SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineJobs TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineJobs TYPE string;
    DEFINE FIELD elasticAgentId ON TABLE pipelineJobs TYPE string;
    DEFINE FIELD [timeout] ON TABLE pipelineJobs TYPE string
        ASSERT $value != NONE; // never, 1h, 30s, 1d

    -- TODO: Enable running on all agents tagged with X tag
    DEFINE FIELD runType ON TABLE pipelineJobs TYPE string
        ASSERT $value != NONE; // allAgents | agentsMarkedX | number

    DEFINE FIELD artifacts.* ON TABLE pipelineJobs TYPE record(pipelineArtifacts);
    DEFINE FIELD environmentVariables.* ON TABLE pipelineStages TYPE record(environmentVariables);


DEFINE TABLE pipelineStages SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineStages TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineStages TYPE string;
    DEFINE FIELD onlyOnPreviousSuccess ON TABLE pipelineStages TYPE string;
    DEFINE FIELD fetchSources ON TABLE pipelineStages TYPE string;
    DEFINE FIELD cleanupArtifacts ON TABLE pipelineStages TYPE string;
    DEFINE FIELD cleanDirectory ON TABLE pipelineStages TYPE string;
    DEFINE FIELD autoTriggerOnPreviousStageCompletion ON TABLE pipelineStages TYPE string;
    DEFINE FIELD environmentVariables.* ON TABLE pipelineStages TYPE record(environmentVariables);
    DEFINE FIELD jobs.* ON TABLE pipelineStages TYPE record(pipelineJobs);


DEFINE TABLE pipelines SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelines TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelines TYPE string;
    DEFINE FIELD stages.* ON TABLE pipelines TYPE record(pipelineStages);
