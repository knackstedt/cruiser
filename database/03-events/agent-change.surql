
DEFINE EVENT agentChange ON TABLE agent WHEN $before != $after THEN (
	CREATE event SET
        user = $value.id,
        time = time::now(),
        value = $after,
        action = 'agent_changed'
);
