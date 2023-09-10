
REMOVE TABLE pipelineTask;
DEFINE TABLE pipelineTask SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD command ON TABLE pipelineTask TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD arguments ON TABLE pipelineTask TYPE array;
    DEFINE FIELD arguments.* ON TABLE pipelineTask TYPE string;
    DEFINE FIELD commandTimeout ON TABLE pipelineTask TYPE any;

    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    DEFINE FIELD label ON TABLE pipelineTask TYPE string;
    DEFINE FIELD description ON TABLE pipelineTask TYPE any;
    DEFINE FIELD workingDirectory ON TABLE pipelineTask TYPE any;

    DEFINE FIELD `order` ON TABLE pipelineTask TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;
    -- True by default
    DEFINE FIELD runIfPreviousTaskPassed ON TABLE pipelineTask TYPE any
        VALUE $value OR true;
    DEFINE FIELD runIfPreviousTaskFailed ON TABLE pipelineTask TYPE any
        VALUE $value OR false;

    DEFINE FIELD freezeBeforeRun ON TABLE pipelineTask TYPE any
        VALUE $value OR false;
    DEFINE FIELD freezeAfterRun ON TABLE pipelineTask TYPE any
        VALUE $value OR false;


    DEFINE FIELD approval ON TABLE pipelineTask TYPE any
        VALUE $value OR false;


    /**
     * Relations
     */
    -- A task to run when this task fails or is cancelled
    DEFINE FIELD taskOnSelfFailure ON TABLE pipelineTask TYPE any;
    DEFINE FIELD environment ON TABLE pipelineTask TYPE any;
    DEFINE FIELD environment.* ON TABLE pipelineTask TYPE any
        ASSERT $value != NONE AND $value != null;

