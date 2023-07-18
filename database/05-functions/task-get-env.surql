
/**
 *
 * Get all of the environment variables for a pipeline task
 */
DEFINE FUNCTION fn::task_get_environment($task: any /*record(pipelineTask)*/) {

    LET $taskGroup = (SELECT * FROM pipelineTaskGroup WHERE tasks CONTAINS $task LIMIT 1)[0];

	RETURN array::concat(
        ($taskGroup.environment OR []),
        ($task.environment OR [])
    );
};
