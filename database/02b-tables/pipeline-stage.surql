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

    DEFINE FIELD environment ON TABLE pipelineStage TYPE array;
    -- DEFINE FIELD environment.* ON TABLE pipelineStage TYPE record(environmentVariable);
    DEFINE FIELD jobs ON TABLE pipelineStage TYPE array;
    -- DEFINE FIELD jobs.* ON TABLE pipelineStage TYPE record(pipelineJob);
