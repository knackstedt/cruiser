
DEFINE TABLE environmentVariable SCHEMAFULL;
    DEFINE FIELD label ON TABLE environmentVariable TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD `value` ON TABLE environmentVariable TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE environmentVariable TYPE string;
    -- DEFINE FIELD target ON TABLE environmentVariable TYPE record
    --     ASSERT $value != NONE;


DEFINE TABLE secret SCHEMAFULL;
    DEFINE FIELD key ON TABLE secret TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD `value` ON TABLE secret TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE secret TYPE string;
    -- DEFINE FIELD target ON TABLE secret TYPE record
    --     ASSERT $value != NONE;

