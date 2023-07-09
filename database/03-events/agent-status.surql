
-- When an agent connects or disconnects...
DEFINE EVENT agentChange ON TABLE agents WHEN $before != $after THEN (
	CREATE event SET
        user = $value.id,
        time = time::now(),
        value = $after,
        action = 'pipeline_changed'
);
