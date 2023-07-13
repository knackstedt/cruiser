
DEFINE TABLE jobInstance SCHEMALESS;
    DEFINE FIELD label ON TABLE jobInstance TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD state ON TABLE jobInstance TYPE string
        ASSERT $value = 'pending'      || // before the agent has connected
               $value = 'initializing' || // agent has connected and is starting up
               $value = 'cloning'      || // agent is cloning repo(s)
               $value = 'building'     || // running build scripts
               $value = 'frozen'       || // paused on a freeze task
               $value = 'sealing'      || // sealing artifacts
               $value = 'finished'     || // Agent has self-completed, pending ack from scheduler
               $value = 'complete';


    DEFINE FIELD job ON TABLE jobInstance TYPE record(pipelineJob);

    -- DEFINE FIELD environment.* ON TABLE jobInstance TYPE record(environmentVariable);
