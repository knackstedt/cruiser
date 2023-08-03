
REMOVE TABLE staticAgent;
DEFINE TABLE staticAgent SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE staticAgent TYPE string
        ASSERT $value != NONE;

    DEFINE FIELD enabled ON TABLE staticAgent TYPE bool
        VALUE $value OR true;

    DEFINE FIELD `version` ON TABLE staticAgent TYPE string
        ASSERT $value = /\d+\.\d+\.\d+/;


    DEFINE FIELD connected ON TABLE staticAgent TYPE bool;
        -- ASSERT ($this.type == 'elastic' && $value = NONE)
            --    ($this.type == 'static'  && $value != NONE);

    DEFINE FIELD configType ON TABLE staticAgent TYPE string
        ASSERT
            ($this.type == "static" && $value = NONE) ||
            ($value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json')
        VALUE $value OR 'json';





    -- DEFINE FIELD environmentVariables.* ON TABLE staticAgent TYPE record(environmentVariable);

    -- DEFINE FIELD agentType ON TABLE agents TYPE string
    --   ASSERT $value == 'linux' || $value == NONE


    /**
     * Agent Stats
     */

    -- Total number of job executions
    DEFINE FIELD runCount ON TABLE staticAgent TYPE int
        ASSERT ($before = NONE || $before < $value);
    -- Total run time duration
    DEFINE FIELD runTime ON TABLE staticAgent TYPE int
        ASSERT ($before = NONE || $before < $value);

    DEFINE FIELD lastRun ON TABLE staticAgent/*  */ TYPE dateTime
        ASSERT ($before = NONE || $before < $value);

    /**
     * Relations
     */



