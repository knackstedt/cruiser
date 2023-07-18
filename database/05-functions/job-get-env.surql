
/**
 *
 * Get all of the environment variables for a pipeline task
 */
DEFINE FUNCTION fn::job_get_environment($job: any /*record(pipelineTask)*/) {

    LET $stage = (SELECT * FROM pipelineStage WHERE jobs CONTAINS $job LIMIT 1)[0];
    LET $pipeline = (SELECT * FROM pipeline WHERE stages CONTAINS $stage LIMIT 1)[0];

	RETURN array::concat(
        ($pipeline.environment OR []),
        array::concat(
            ($stage.environment OR []),
            ($job.environment OR [])
        )
    );
};
