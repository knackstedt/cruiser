DEFINE TABLE agent SCHEMAFULL;

DEFINE FIELD label ON TABLE agent TYPE string
    ASSERT $value != NONE;
DEFINE FIELD `type` ON TABLE agent TYPE string
    ASSERT $value = 'elastic' || $value = 'static';

DEFINE FIELD configType ON TABLE agent TYPE string
    ASSERT $value = 'properties' || $value = 'remoteFile' || $value = 'yaml' || $value == 'json';

DEFINE FIELD remoteFileUrl ON TABLE agent TYPE string;
DEFINE FIELD remoteFileType ON TABLE agent TYPE string
    ASSERT $value = 'json' || $value = 'yaml' || $value = NONE;


DEFINE FIELD environmentVariables.* ON TABLE agent TYPE record(environmentVariable);

DEFINE FIELD dockerImage ON TABLE agent TYPE string;

DEFINE FIELD maxCpuLimit ON TABLE agent TYPE string;
DEFINE FIELD maxMemLimit ON TABLE agent TYPE string;

DEFINE FIELD priviliged ON TABLE agent TYPE bool;


-- DEFINE FIELD agentType ON TABLE agents TYPE string
--   ASSERT $value == 'linux' || $value == NONE




