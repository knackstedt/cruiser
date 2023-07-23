
REMOVE TABLE taskFreezePoints;
DEFINE TABLE taskFreezePoints SCHEMALESS;
    DEFINE FIELD taskGroup ON TABLE taskFreezePoints TYPE any /* record(pipelineTaskGroup) */
        ASSERT $value != NONE;
    DEFINE FIELD jobInstance ON TABLE taskFreezePoints TYPE any /* record(jobInstance) */
        ASSERT $value != NONE;
