DEFINE TABLE pipelineArtifact SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineArtifact TYPE string;
    DEFINE FIELD source ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD destination ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;


DEFINE TABLE pipelineTask SCHEMAFULL;
    DEFINE FIELD command ON TABLE pipelineTask TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD label ON TABLE pipelineTask TYPE string;
    DEFINE FIELD description ON TABLE pipelineTask TYPE string;
    DEFINE FIELD workingDirectory ON TABLE pipelineTask TYPE string;
    DEFINE FIELD "order" ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    -- True by default
    DEFINE FIELD runIfPreviousTaskPassed ON TABLE pipelineTask TYPE string
        VALUE $value OR true;
    DEFINE FIELD runIfPreviousTaskFailed ON TABLE pipelineTask TYPE string
        VALUE $value OR false;

    DEFINE FIELD freezeBeforeRun ON TABLE pipelineTask TYPE string
        VALUE $value OR false;
    DEFINE FIELD freezeAfterRun ON TABLE pipelineTask TYPE string
        VALUE $value OR false;

    -- A task to run when this task fails or is cancelled
    DEFINE FIELD taskOnSelfFailure ON TABLE pipelineTask TYPE record(pipelineTask);
    DEFINE FIELD environment.* ON TABLE pipelineTask TYPE record(environmentVariable);

DEFINE TABLE pipelineTaskGroup SCHEMAFULL;
    DEFINE FIELD label ON TABLE pipelineTaskGroup TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineTaskGroup TYPE string;
    DEFINE FIELD "order" ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    -- A task to run when this task fails or is cancelled
    DEFINE FIELD environment.* ON TABLE pipelineTaskGroup TYPE record(environmentVariable);
    DEFINE FIELD tasks.* ON TABLE pipelineTaskGroup TYPE record(pipelineTask);


DEFINE TABLE pipelineJob SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineJob TYPE string;
    DEFINE FIELD elasticAgentId ON TABLE pipelineJob TYPE string;
    DEFINE FIELD "order" ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    DEFINE FIELD [timeout] ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE
        VALUE $value OR 30; // never, 1h, 30s, 1d

    -- TODO: Enable running on all agents tagged with X tag
    DEFINE FIELD runType ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE; // allAgents | agentsMarkedX | number

    DEFINE FIELD taskGroups.* ON TABLE pipelineJob TYPE record(pipelineTaskGroup);
    DEFINE FIELD artifacts.* ON TABLE pipelineJob TYPE record(pipelineArtifact);
    DEFINE FIELD environment.* ON TABLE pipelineJob TYPE record(environmentVariable);


DEFINE TABLE pipelineStage SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipelineStage TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineStage TYPE string;
    DEFINE FIELD "order" ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    DEFINE FIELD onlyOnPreviousSuccess ON TABLE pipelineStage TYPE string;
    DEFINE FIELD fetchSources ON TABLE pipelineStage TYPE string;
    DEFINE FIELD cleanupArtifacts ON TABLE pipelineStage TYPE string;
    DEFINE FIELD cleanDirectory ON TABLE pipelineStage TYPE string;
    DEFINE FIELD autoTriggerOnPreviousStageCompletion ON TABLE pipelineStage TYPE string;
    DEFINE FIELD environment.* ON TABLE pipelineStage TYPE record(environmentVariable);
    DEFINE FIELD jobs.* ON TABLE pipelineStage TYPE record(pipelineJob);


DEFINE TABLE pipeline SCHEMAFULL;
    DEFINE FIELD name ON TABLE pipeline TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipeline TYPE string;
    DEFINE FIELD "order" ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    DEFINE FIELD stages.* ON TABLE pipeline TYPE record(pipelineStage);
    DEFINE FIELD environment.* ON TABLE pipeline TYPE record(environmentVariable);
