
REMOVE TABLE pipeline;
DEFINE TABLE pipeline SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipeline TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipeline TYPE string;
    DEFINE FIELD `group` ON TABLE pipeline TYPE string
        VALUE $value OR 'default';
    DEFINE FIELD labelTemplate ON TABLE pipeline TYPE string;

    DEFINE FIELD state ON TABLE pipeline TYPE string
        ASSERT $value == 'new' || $value == 'locked' || $value == 'paused' || $value == 'active'
        VALUE $value OR 'new';

    DEFINE FIELD lockingBehavior ON TABLE pipeline TYPE string
        ASSERT $value == 'singleton' || $value == 'singletonNoFail' || $value == 'multiple'
        VALUE $value OR 'multiple';


    DEFINE FIELD automaticScheduling ON TABLE pipeline TYPE bool
        VALUE $value OR true;

    DEFINE FIELD cronSchedule ON TABLE pipeline TYPE string
        VALUE $value = NONE OR $value = /^(?#minute)(\*|(?:[0-9]|(?:[1-5][0-9]))(?:(?:\-[0-9]|\-(?:[1-5][0-9]))?|(?:\,(?:[0-9]|(?:[1-5][0-9])))*)) (?#hour)(\*|(?:[0-9]|1[0-9]|2[0-3])(?:(?:\-(?:[0-9]|1[0-9]|2[0-3]))?|(?:\,(?:[0-9]|1[0-9]|2[0-3]))*)) (?#day_of_month)(\*|(?:[1-9]|(?:[12][0-9])|3[01])(?:(?:\-(?:[1-9]|(?:[12][0-9])|3[01]))?|(?:\,(?:[1-9]|(?:[12][0-9])|3[01]))*)) (?#month)(\*|(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(?:\-(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))?|(?:\,(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))*)) (?#day_of_week)(\*|(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT)(?:(?:\-(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))?|(?:\,(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))*))$/;
    DEFINE FIELD cronRunOnlyOnNewSource ON TABLE pipeline TYPE bool
        VALUE $value OR false;

    DEFINE FIELD trackingToolPattern ON TABLE pipeline TYPE string;
    DEFINE FIELD trackingToolUri ON TABLE pipeline TYPE string;

    DEFINE FIELD `order` ON TABLE pipeline TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;


    /**
     * Relations
     */
    DEFINE FIELD stages ON TABLE pipeline TYPE array;
    -- DEFINE FIELD stages.* ON TABLE pipeline TYPE record(pipelineStage);
    DEFINE FIELD environment ON TABLE pipeline TYPE array;
    -- DEFINE FIELD environment.* ON TABLE pipeline TYPE record(environmentVariable);
    DEFINE FIELD sources ON TABLE pipeline TYPE array;
    -- DEFINE FIELD sources.* ON TABLE pipeline TYPE record(pipelineSource);
