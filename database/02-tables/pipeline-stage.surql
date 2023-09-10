
REMOVE TABLE pipelineStage;
DEFINE TABLE pipelineStage SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineStage TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineStage TYPE any;
    DEFINE FIELD order ON TABLE pipelineStage TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    DEFINE FIELD onlyOnPreviousSuccess ON TABLE pipelineStage TYPE any
        VALUE $value OR false;
    DEFINE FIELD fetchSources ON TABLE pipelineStage TYPE any
        VALUE $value OR false;
    DEFINE FIELD cleanupArtifacts ON TABLE pipelineStage TYPE any
        VALUE $value OR false;
    DEFINE FIELD cleanDirectory ON TABLE pipelineStage TYPE any
        VALUE $value OR false;
    DEFINE FIELD autoTriggerOnPreviousStageCompletion ON TABLE pipelineStage TYPE any
        VALUE $value OR false;

    /**
     * Relations
     */
    DEFINE FIELD environment ON TABLE pipelineStage TYPE any;
    DEFINE FIELD environment.* ON TABLE pipelineStage TYPE any
        ASSERT $value != NONE AND $value != null;
    DEFINE FIELD jobs ON TABLE pipelineStage TYPE array;
    DEFINE FIELD jobs.* ON TABLE pipelineStage TYPE any
        ASSERT $value != NONE AND $value != null;
