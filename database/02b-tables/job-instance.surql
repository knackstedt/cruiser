
DEFINE TABLE jobInstance SCHEMALESS;
    DEFINE FIELD kubeNamespace ON TABLE jobInstance TYPE string;
    DEFINE FIELD kubePod ON TABLE jobInstance TYPE string;

    /**
     * General
     */
    DEFINE FIELD state ON TABLE jobInstance TYPE string
        ASSERT $value = 'pending'      || // before the agent has connected
               $value = 'initializing' || // agent has connected and is starting up
               $value = 'cloning'      || // agent is cloning repo(s)
               $value = 'building'     || // running build scripts
               $value = 'frozen'       || // paused on a freeze task
               $value = 'sealing'      || // sealing artifacts
               $value = 'finished'     || // Agent has self-completed, pending ack from scheduler
               $value = 'complete';

    /**
     * Stats
     */
    -- When the job gets queued
    DEFINE FIELD queueTime ON TABLE staticagent TYPE datetime
        ASSERT ($before = NONE || $before = $value);
    -- When the job goes from `pending` to `initializing`
    DEFINE FIELD startTime ON TABLE staticagent TYPE datetime
        ASSERT ($before = NONE || $before = $value);
    -- when the job goes to finished
    DEFINE FIELD endTime ON TABLE staticagent TYPE datetime
        ASSERT ($before = NONE || $before = $value);

    DEFINE FIELD errorCount ON TABLE staticagent TYPE int
        ASSERT $value >= 0;
    DEFINE FIELD warnCount ON TABLE staticagent TYPE int
        ASSERT $value >= 0;


    /**
     * Relations
     */
    DEFINE FIELD job ON TABLE jobInstance TYPE record(pipelineJob);
    DEFINE FIELD agent ON TABLE jobInstance TYPE record(agent);

    -- DEFINE FIELD environment.* ON TABLE jobInstance TYPE record(environmentVariable);
