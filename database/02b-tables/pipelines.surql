DEFINE TABLE pipelineArtifact SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineArtifact TYPE string;
    DEFINE FIELD source ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD destination ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;


DEFINE TABLE pipelineTask SCHEMALESS;
    DEFINE FIELD command ON TABLE pipelineTask TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD label ON TABLE pipelineTask TYPE string;
    DEFINE FIELD description ON TABLE pipelineTask TYPE string;
    DEFINE FIELD workingDirectory ON TABLE pipelineTask TYPE string;
    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    -- True by default
    DEFINE FIELD runIfPreviousTaskPassed ON TABLE pipelineTask TYPE bool
        VALUE $value OR true;
    DEFINE FIELD runIfPreviousTaskFailed ON TABLE pipelineTask TYPE bool
        VALUE $value OR false;

    DEFINE FIELD freezeBeforeRun ON TABLE pipelineTask TYPE bool
        VALUE $value OR false;
    DEFINE FIELD freezeAfterRun ON TABLE pipelineTask TYPE bool
        VALUE $value OR false;

    -- A task to run when this task fails or is cancelled
    DEFINE FIELD taskOnSelfFailure ON TABLE pipelineTask TYPE record(pipelineTask);
    -- DEFINE FIELD environment.* ON TABLE pipelineTask TYPE record(environmentVariable);

DEFINE TABLE pipelineTaskGroup SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineTaskGroup TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineTaskGroup TYPE string;
    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    -- A task to run when this task fails or is cancelled
    -- DEFINE FIELD environment.* ON TABLE pipelineTaskGroup TYPE record(environmentVariable);
    -- DEFINE FIELD tasks.* ON TABLE pipelineTaskGroup TYPE record(pipelineTask);


DEFINE TABLE pipelineJob SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineJob TYPE string;
    DEFINE FIELD elasticAgentId ON TABLE pipelineJob TYPE string;
    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    DEFINE FIELD `timeout` ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE
        VALUE $value OR 30; // never, 1h, 30s, 1d

    -- TODO: Enable running on all agents tagged with X tag
    DEFINE FIELD runType ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE; // allAgents | agentsMarkedX | number

    -- DEFINE FIELD taskGroups.* ON TABLE pipelineJob TYPE record(pipelineTaskGroup);
    -- DEFINE FIELD artifacts.* ON TABLE pipelineJob TYPE record(pipelineArtifact);
    -- DEFINE FIELD environment.* ON TABLE pipelineJob TYPE record(environmentVariable);


DEFINE TABLE pipelineStage SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineStage TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineStage TYPE string;
    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    DEFINE FIELD onlyOnPreviousSuccess ON TABLE pipelineStage TYPE bool;
    DEFINE FIELD fetchSources ON TABLE pipelineStage TYPE bool;
    DEFINE FIELD cleanupArtifacts ON TABLE pipelineStage TYPE bool;
    DEFINE FIELD cleanDirectory ON TABLE pipelineStage TYPE bool;
    DEFINE FIELD autoTriggerOnPreviousStageCompletion ON TABLE pipelineStage TYPE bool;
    -- DEFINE FIELD environment.* ON TABLE pipelineStage TYPE record(environmentVariable);
    -- DEFINE FIELD jobs.* ON TABLE pipelineStage TYPE record(pipelineJob);


DEFINE TABLE pipelineSource SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineSource TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineSource TYPE string;
    DEFINE FIELD targetPath ON TABLE pipelineSource TYPE string;
        -- where the source is put in the agent's filesystem relative to the build dir
    DEFINE FIELD `type` ON TABLE pipelineSource TYPE string;
        -- git / svn / tfs

    DEFINE FIELD branch ON TABLE pipelineSource TYPE string;
    DEFINE FIELD username ON TABLE pipelineSource TYPE string;
    -- TODO: Deal with storing this later.
    -- DEFINE FIELD `password` ON TABLE pipelineSource TYPE record(secret);
    DEFINE FIELD cloneDepth ON TABLE pipelineSource TYPE int
        VALUE $value OR -1;
    DEFINE FIELD pollingBehavior ON TABLE pipelineSource TYPE string;
        -- onlyWebhook
        -- poll
        -- poll (duration)

    DEFINE FIELD denyList ON TABLE pipelineSource TYPE string;
    DEFINE FIELD invertFilter ON TABLE pipelineSource TYPE bool;


    DEFINE FIELD url ON TABLE pipelineSource TYPE string
        ASSERT $value != NONE;
    -- DEFINE FIELD pipelines.* ON TABLE pipelineSource TYPE record(pipeline)
        -- ASSERT $value != NONE;



DEFINE TABLE pipeline SCHEMALESS;
    DEFINE FIELD label ON TABLE pipeline TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipeline TYPE string;
    DEFINE FIELD `group` ON TABLE pipeline TYPE string
        VALUE $value OR 'default';
    DEFINE FIELD labelTemplate ON TABLE pipeline TYPE string;

    DEFINE FIELD state ON TABLE pipeline TYPE string
        ASSERT $value == 'locked' || $value == 'paused' || $value == 'active'
        VALUE $value OR 'paused';

    DEFINE FIELD lockingBehavior ON TABLE pipeline TYPE string
        ASSERT $value == 'singleton' || $value == 'singletonNoFail' || $value == 'multiple'
        VALUE $value OR 'multiple';


    DEFINE FIELD automaticScheduling ON TABLE pipeline TYPE bool
        VALUE $value OR true;

    DEFINE FIELD cronSchedule ON TABLE pipeline TYPE string
        VALUE $value = NONE OR $value = /^(?#minute)(\*|(?:[0-9]|(?:[1-5][0-9]))(?:(?:\-[0-9]|\-(?:[1-5][0-9]))?|(?:\,(?:[0-9]|(?:[1-5][0-9])))*)) (?#hour)(\*|(?:[0-9]|1[0-9]|2[0-3])(?:(?:\-(?:[0-9]|1[0-9]|2[0-3]))?|(?:\,(?:[0-9]|1[0-9]|2[0-3]))*)) (?#day_of_month)(\*|(?:[1-9]|(?:[12][0-9])|3[01])(?:(?:\-(?:[1-9]|(?:[12][0-9])|3[01]))?|(?:\,(?:[1-9]|(?:[12][0-9])|3[01]))*)) (?#month)(\*|(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(?:\-(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))?|(?:\,(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))*)) (?#day_of_week)(\*|(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT)(?:(?:\-(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))?|(?:\,(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))*))$/;
    DEFINE FIELD cronRunOnlyOnNewSource ON TABLE pipeline TYPE bool
        VALUE $value OR false;

    DEFINE FIELD trackingToolPattern ON TABLE pipeline TYPE string;
    DEFINE FIELD trackingToolUri ON TABLE pipeline TYPE string;

    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    -- DEFINE FIELD stages.* ON TABLE pipeline TYPE record(pipelineStage);
    -- DEFINE FIELD environment.* ON TABLE pipeline TYPE record(environmentVariable);
    -- DEFINE FIELD sources.* ON TABLE pipeline TYPE record(pipelineSource);
