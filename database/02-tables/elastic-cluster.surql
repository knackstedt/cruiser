
REMOVE TABLE elasticCluster;
DEFINE TABLE elasticCluster SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE elasticCluster TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD `type` ON TABLE elasticCluster TYPE string
        ASSERT $value = 'docker' || $value = 'kubernetes';

    DEFINE FIELD configType ON TABLE elasticCluster TYPE string
        ASSERT $value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json';

    DEFINE FIELD dotOpsClusterUrl ON TABLE elasticCluster TYPE string;

    DEFINE FIELD startupTimeout ON TABLE elasticCluster TYPE int
        ASSERT $value > 0
        VALUE $value OR 10;
    DEFINE FIELD registerTimeout ON TABLE elasticCluster TYPE int
        ASSERT $value > 0
        VALUE $value OR 10;


    /**
     * Cluster configuration
     */
    DEFINE FIELD kubeClusterUrl ON TABLE elasticCluster TYPE string;
    DEFINE FIELD kubeNamespace ON TABLE elasticCluster TYPE string;

    DEFINE FIELD kubeToken ON TABLE elasticCluster TYPE record(secret);
    DEFINE FIELD kubeCAData ON TABLE elasticCluster TYPE record(secret);


    -- DEFINE FIELD environmentVariables.* ON TABLE elasticCluster TYPE record(environmentVariable);




