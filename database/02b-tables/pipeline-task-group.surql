DEFINE TABLE pipelineTaskGroup SCHEMALESS;
    DEFINE FIELD label ON TABLE pipelineTaskGroup TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineTaskGroup TYPE string;
    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    -- A task to run when this task fails or is cancelled
    DEFINE FIELD environment ON TABLE pipelineTaskGroup TYPE array;
    -- DEFINE FIELD environment.* ON TABLE pipelineTaskGroup TYPE record(environmentVariable);
    DEFINE FIELD tasks ON TABLE pipelineTaskGroup TYPE array;
    -- DEFINE FIELD tasks.* ON TABLE pipelineTaskGroup TYPE record(pipelineTask);
