DEFINE TABLE pipelineApproval SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineApproval TYPE string;
    DEFINE FIELD description ON TABLE pipelineApproval TYPE string;
    DEFINE FIELD arguments ON TABLE pipelineApproval TYPE array;

    DEFINE FIELD date ON TABLE pipelineApproval TYPE datetime
        VALUE date::now();

    /**
     * Relations
     */
    DEFINE FIELD pipeline ON TABLE pipelineApproval TYPE record(pipeline);

