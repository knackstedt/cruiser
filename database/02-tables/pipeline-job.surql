
REMOVE TABLE pipelineJob;
DEFINE TABLE pipelineJob SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD elasticAgentId ON TABLE pipelineJob TYPE string;
    DEFINE FIELD description ON TABLE pipelineJob TYPE string;
    DEFINE FIELD agentPool ON TABLE pipelineJob TYPE record(agentPool);
    DEFINE FIELD `order` ON TABLE pipelineJob TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    DEFINE FIELD `timeout` ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE
        VALUE $value OR 30; // never, 1h, 30s, 1d

    -- TODO: Enable running on all agents tagged with X tag
    DEFINE FIELD runType ON TABLE pipelineJob TYPE string
        ASSERT $value != NONE; // allAgents | agentsMarkedX | number

    DEFINE FIELD invocationCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    DEFINE FIELD failCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    DEFINE FIELD runState ON TABLE pipelineJob TYPE string;
        ASSERT $value = NONE || $value = 'success' || $value = 'fail' || $value = 'running';
    DEFINE FIELD lastRun ON TABLE pipelineJob TYPE datetime;
    DEFINE FIELD lastTriggerReason ON TABLE pipelineJob TYPE string
        ASSERT $value = NONE || $value = 'cron' || $value = 'changes' || $value = 'manual' || $value = 'webhook';

    /**
     * Relations
     */
    DEFINE FIELD taskGroups ON TABLE pipelineJob TYPE array;
    -- DEFINE FIELD taskGroups.* ON TABLE pipelineJob TYPE record(pipelineTaskGroup);
    DEFINE FIELD artifacts ON TABLE pipelineJob TYPE array;
    -- DEFINE FIELD artifacts.* ON TABLE pipelineJob TYPE record(pipelineArtifact);
    DEFINE FIELD environment ON TABLE pipelineJob TYPE array;
    -- DEFINE FIELD environment.* ON TABLE pipelineJob TYPE record(environmentVariable);
