DEFINE TABLE elasticAgentPool SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE elasticAgentPool TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD `type` ON TABLE elasticAgentPool TYPE string
        ASSERT ($value = 'elastic' || $value = 'static') && ($before = $value || $before = NONE);

    DEFINE FIELD configType ON TABLE elasticAgentPool TYPE string
        ASSERT
            ($this.type == "static" && $value = NONE) ||
            ($value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json')
        VALUE $value OR 'json';


    -- DEFINE FIELD environmentVariables.* ON TABLE elasticAgentPool TYPE record(environmentVariable);
    /**
     * Elastic Agent Properties
     */
    DEFINE FIELD remoteFileUrl ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD remoteFileType ON TABLE elasticAgentPool TYPE string
        ASSERT
        ($this.type = 'static' && $value = NONE) ||
        ($this.type = 'elastic' &&
            (
                $value = 'json' ||
                $value = 'yaml' ||
                $value = NONE
            )
        );

    DEFINE FIELD kubeNamespace ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD kubeContainerImage ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';

    DEFINE FIELD kubeContainerTaints ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD kubeContainerTolerations ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD kubeContainerLabels ON TABLE elasticAgentPool TYPE array
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD kubeContainerAttributes ON TABLE elasticAgentPool TYPE array
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';


    DEFINE FIELD maxCpuLimit ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';
    DEFINE FIELD maxMemLimit ON TABLE elasticAgentPool TYPE string
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';

    DEFINE FIELD priviliged ON TABLE elasticAgentPool TYPE bool
        ASSERT ($this.type = 'static' && $value = NONE) || $this.type = 'elastic';

    -- DEFINE FIELD agentType ON TABLE agents TYPE string
    --   ASSERT $value == 'linux' || $value == NONE

    /**
     * Pool Stats
     */

    DEFINE FIELD invocationCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    DEFINE FIELD failCount ON TABLE pipelineSource TYPE int
        ASSERT $value >= 0
        VALUE $value OR 0;

    -- Total run time duration
    DEFINE FIELD runTime ON TABLE elasticAgentPool TYPE int
        ASSERT ($before = NONE || $before < $value);
    DEFINE FIELD lastRun ON TABLE elasticAgentPool TYPE dateTime
        ASSERT ($before = NONE || $before < $value);




