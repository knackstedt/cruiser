
REMOVE TABLE pipeline;
DEFINE TABLE pipeline SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipeline TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipeline TYPE string;
    DEFINE FIELD `group` ON TABLE pipeline TYPE option<string>
        VALUE $value OR 'default';
    DEFINE FIELD labelTemplate ON TABLE pipeline TYPE string;

    DEFINE FIELD state ON TABLE pipeline TYPE string
        ASSERT $value == 'new' || $value == 'locked' || $value == 'paused' || $value == 'active'
        VALUE $value OR 'new';


    -- Historical versions of this pipeline (can only add new records)
    DEFINE FIELD history ON TABLE pipeline TYPE array
        -- ASSERT ($before = NONE AND $value != NONE)
        VALUE array::union($before OR [], $value);
    DEFINE FIELD history.* ON TABLE pipeline TYPE any; // record(objectHistory)


    -- If this is actually a pipeline template.
    DEFINE FIELD isTemplate ON TABLE pipeline TYPE option<bool>;
    DEFINE FIELD pipelineTemplate ON TABLE pipeline TYPE option<record(pipeline)>;

    -- If this is a cloned pipeline for the purpose of users editing
    -- and being able to apply their changes without live updating the
    -- original pipeline
    DEFINE FIELD isUserEditInstance ON TABLE pipeline TYPE option<bool>;
    -- if isUserEditInstance is true, this is the reference to the real pipeline
    -- for when a user saves it.
    DEFINE FIELD pipeline ON TABLE pipeline TYPE option<record(pipeline)>
        ASSERT ($this.isUSerEditInstance = true AND $value != NONE) OR $value = NONE;

    DEFINE FIELD lockingBehavior ON TABLE pipeline TYPE string
        ASSERT $value == 'singleton' || $value == 'singletonNoFail' || $value == 'multiple'
        VALUE $value OR 'multiple';

    DEFINE FIELD automaticScheduling ON TABLE pipeline TYPE option<bool>
        VALUE $value OR true;

    DEFINE FIELD cronSchedule ON TABLE pipeline TYPE option<string>;
    DEFINE FIELD cronRunOnlyOnNewSource ON TABLE pipeline TYPE option<bool>
        VALUE $value OR false;

    DEFINE FIELD trackingToolPattern ON TABLE pipeline TYPE option<string>;
    DEFINE FIELD trackingToolUri ON TABLE pipeline TYPE option<string>;

    DEFINE FIELD `order` ON TABLE pipeline TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    /**
     * Relations
     */
    DEFINE FIELD stages ON TABLE pipeline TYPE option<array>;
    DEFINE FIELD stages.* ON TABLE pipeline TYPE record(pipelineStage);
    DEFINE FIELD environment ON TABLE pipeline TYPE option<array>;
    DEFINE FIELD environment.* ON TABLE pipeline TYPE any;
    DEFINE FIELD sources ON TABLE pipeline TYPE option<array>;
    DEFINE FIELD sources.* ON TABLE pipeline TYPE record(pipelineSource);
