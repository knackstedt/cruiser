
DEFINE EVENT pipelineChange ON TABLE pipelines WHEN $before != $after THEN (
	CREATE event SET
        user = $value.id,
        time = time::now(),
        value = $after,
        action = 'pipeline_changed'
);
