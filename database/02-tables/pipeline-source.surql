
REMOVE TABLE pipelineSource;
DEFINE TABLE pipelineSource SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineSource TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineSource TYPE string;
    DEFINE FIELD targetPath ON TABLE pipelineSource TYPE string;
        -- where the source is put in the agent's filesystem relative to the build dir
    DEFINE FIELD `type` ON TABLE pipelineSource TYPE string;
        -- git / svn / tfs
    DEFINE FIELD order ON TABLE pipelineSource TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    DEFINE FIELD branch ON TABLE pipelineSource TYPE option<string>;
    DEFINE FIELD username ON TABLE pipelineSource TYPE option<string>;
    -- TODO: Deal with storing this later.
    -- DEFINE FIELD `password` ON TABLE pipelineSource TYPE record(secret);
    DEFINE FIELD cloneDepth ON TABLE pipelineSource TYPE option<int>
        VALUE $value OR -1;
    DEFINE FIELD pollingBehavior ON TABLE pipelineSource TYPE option<string>;
        -- onlyWebhook
        -- poll
        -- poll (duration)

    DEFINE FIELD denyList ON TABLE pipelineSource TYPE option<string>;
    DEFINE FIELD invertFilter ON TABLE pipelineSource TYPE option<bool>;


    DEFINE FIELD url ON TABLE pipelineSource TYPE string
        ASSERT $value != NONE AND $value != null;
