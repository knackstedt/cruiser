
REMOVE TABLE elasticAgent;
DEFINE TABLE elasticAgent SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE elasticAgent TYPE string
        ASSERT $value != NONE;

    DEFINE FIELD environmentVariables ON TABLE elasticAgent TYPE array;
    DEFINE FIELD environmentVariables.* ON TABLE elasticAgent TYPE object;

    DEFINE FIELD configType ON TABLE elasticAgent TYPE string
        ASSERT
            ($value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json')
        VALUE $value OR 'json';


    -- DEFINE FIELD environmentVariables.* ON TABLE elasticAgent TYPE record(environmentVariable);
    /**
     * Elastic Agent Properties
     */
    DEFINE FIELD remoteFileUrl ON TABLE elasticAgent TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD remoteFileType ON TABLE elasticAgent TYPE string
        ASSERT
        ($this.type = 'elastic' &&
            (
                $value = 'json' ||
                $value = 'yaml' ||
                $value = NONE
            )
        );

    -- URL that the agents will use to communicate back.
    DEFINE FIELD dotOpsClusterUrl ON TABLE elasticAgent TYPE string;

    -- How long does the elastic agent wait before assuming a pod won't or can't start
    DEFINE FIELD startupTimeout ON TABLE elasticAgent TYPE int
        ASSERT $value > 0
        VALUE $value OR 10;
    DEFINE FIELD registerTimeout ON TABLE elasticAgent TYPE int
        ASSERT $value > 0
        VALUE $value OR 10;

    /**
     * Kube configuration
     */
    DEFINE FIELD kubeClusterUrl ON TABLE elasticAgent TYPE string;
    DEFINE FIELD kubeNamespace ON TABLE elasticAgent TYPE string;

    DEFINE FIELD kubeToken ON TABLE elasticAgent TYPE record(secret);
    DEFINE FIELD kubeCAData ON TABLE elasticAgent TYPE record(secret);


    -- DEFINE FIELD kubeNamespace ON TABLE elasticAgent TYPE string
    --     ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD kubeContainerImage ON TABLE elasticAgent TYPE string;

    DEFINE FIELD kubeContainerTolerations ON TABLE elasticAgent TYPE string;
    DEFINE FIELD kubeContainerLabels ON TABLE elasticAgent TYPE array;
    DEFINE FIELD kubeContainerAttributes ON TABLE elasticAgent TYPE array;


    DEFINE FIELD kubeCpuLimit ON TABLE elasticAgent TYPE string;
    DEFINE FIELD kubeMemLimit ON TABLE elasticAgent TYPE string;
    DEFINE FIELD kubeCpuRequest ON TABLE elasticAgent TYPE string;
    DEFINE FIELD kubeMemRequest ON TABLE elasticAgent TYPE string;

    -- Should the container run priviliged
    DEFINE FIELD priviliged ON TABLE elasticAgent TYPE bool;

    -- DEFINE FIELD agentType ON TABLE agents TYPE string
    --   ASSERT $value == 'linux' || $value == NONE

    /**
     * Statistics
     */
    DEFINE FIELD invocationCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    DEFINE FIELD failCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    -- Total run time duration
    DEFINE FIELD runTime ON TABLE elasticAgent TYPE int;
        -- ASSERT ($before = NONE || $before < $value);
    -- DEFINE FIELD lastRun ON TABLE elasticAgent TYPE dateTime;
        -- ASSERT ($before = NONE || $before < $value);


    /**
     * Relationships
     */


