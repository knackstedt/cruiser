
DEFINE TABLE environmentVariable SCHEMAFULL;
    DEFINE FIELD key ON TABLE environmentVariable TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD `value` ON TABLE environmentVariable TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE environmentVariable TYPE string;
    DEFINE FIELD isSecret ON TABLE environmentVariable TYPE bool
        ASSERT $value != NONE;


