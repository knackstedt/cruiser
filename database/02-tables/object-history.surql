
REMOVE TABLE objectHistory;
DEFINE TABLE objectHistory SCHEMALESS;
    DEFINE FIELD target ON TABLE objectHistory TYPE record(any)
        ASSERT ($before = none OR $value = $before) AND $value != NONE;
    DEFINE FIELD data ON TABLE objectHistory TYPE string
        ASSERT ($before = none OR $value = $before) AND $value != NONE;
    DEFINE FIELD changedBy ON TABLE objectHistory TYPE record(any) // user
        ASSERT ($before = none OR $value = $before);// AND $value != NONE;
    DEFINE FIELD changeDate ON TABLE objectHistory TYPE datetime
        ASSERT ($before = none OR $value = $before) AND $value != NONE;
    DEFINE FIELD changeType ON TABLE objectHistory TYPE string
        ASSERT ($before = none OR $value = $before) AND $value != NONE;
    DEFINE FIELD comment ON TABLE objectHistory TYPE string
        ASSERT ($before = none OR $value = $before);
