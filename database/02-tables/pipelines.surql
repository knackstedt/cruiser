DEFINE TABLE pipelines SCHEMAFULL

DEFINE FIELD name ON TABLE pipelines TYPE string
  ASSERT $value != NONE;
DEFINE FIELD description ON TABLE pipelines TYPE string




