DEFINE TABLE agents SCHEMAFULL;

DEFINE FIELD name ON TABLE agents TYPE string
  ASSERT $value != NONE;
-- DEFINE FIELD agentType ON TABLE agents TYPE string
--   ASSERT $value == 'linux' || $value == NONE




