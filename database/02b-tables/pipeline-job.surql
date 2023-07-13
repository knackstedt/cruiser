
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

    DEFINE FIELD taskGroups ON TABLE pipelineJob TYPE array;
    DEFINE FIELD taskGroups.* ON TABLE pipelineJob TYPE record(pipelineTaskGroup);
    DEFINE FIELD artifacts ON TABLE pipelineJob TYPE array;
    DEFINE FIELD artifacts.* ON TABLE pipelineJob TYPE record(pipelineArtifact);
    DEFINE FIELD environment ON TABLE pipelineJob TYPE array;
    DEFINE FIELD environment.* ON TABLE pipelineJob TYPE record(environmentVariable);
