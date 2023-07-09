
DEFINE TABLE environmentVariables SCHEMAFULL;
    DEFINE FIELD name ON TABLE environmentVariables TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD [value] ON TABLE environmentVariables TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE environmentVariables TYPE string;
    DEFINE FIELD target ON TABLE environmentVariables TYPE record
        ASSERT $value != NONE;


DEFINE TABLE secrets SCHEMAFULL;
    DEFINE FIELD key ON TABLE secrets TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD [value] ON TABLE secrets TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE secrets TYPE string;
    DEFINE FIELD target ON TABLE secrets TYPE record
        ASSERT $value != NONE;

