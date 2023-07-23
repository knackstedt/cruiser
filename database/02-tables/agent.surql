
REMOVE TABLE staticagent;
DEFINE TABLE staticagent SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE staticagent TYPE string
        ASSERT $value != NONE;

    DEFINE FIELD enabled ON TABLE staticagent TYPE bool
        VALUE $value OR true;

    DEFINE FIELD `version` ON TABLE staticagent TYPE string
        ASSERT $value = /\d+\.\d+\.\d+/;


    DEFINE FIELD connected ON TABLE staticagent TYPE bool;
        -- ASSERT ($this.type == 'elastic' && $value = NONE)
            --    ($this.type == 'static'  && $value != NONE);

    DEFINE FIELD configType ON TABLE staticagent TYPE string
        ASSERT
            ($this.type == "static" && $value = NONE) ||
            ($value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json')
        VALUE $value OR 'json';





    -- DEFINE FIELD environmentVariables.* ON TABLE staticagent TYPE record(environmentVariable);

    -- DEFINE FIELD agentType ON TABLE agents TYPE string
    --   ASSERT $value == 'linux' || $value == NONE


    /**
     * Agent Stats
     */

    -- Total number of job executions
    DEFINE FIELD runCount ON TABLE staticagent TYPE int
        ASSERT ($before = NONE || $before < $value);
    -- Total run time duration
    DEFINE FIELD runTime ON TABLE staticagent TYPE int
        ASSERT ($before = NONE || $before < $value);

    DEFINE FIELD lastRun ON TABLE staticagent/*  */ TYPE dateTime
        ASSERT ($before = NONE || $before < $value);

    /**
     * Relations
     */



