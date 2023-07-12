
DEFINE TABLE jobQueue SCHEMALESS;
    DEFINE FIELD label ON TABLE jobQueue TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD elasticAgentId ON TABLE jobQueue TYPE string;


    DEFINE FIELD job ON TABLE jobQueue TYPE record(pipelineJob);

    -- DEFINE FIELD environment.* ON TABLE jobQueue TYPE record(environmentVariable);
