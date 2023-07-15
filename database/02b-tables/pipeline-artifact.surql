DEFINE TABLE pipelineArtifact SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineArtifact TYPE string;
    DEFINE FIELD source ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD destination ON TABLE pipelineArtifact TYPE string
        ASSERT $value != NONE;
