import { getSocketLogger } from '../socket/logger';
import { JobDefinition } from '../types/pipeline';

export const validateJobCanRun = async (
    job: JobDefinition,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();

    if (tasks.length == 0) {
        const err = {
            msg: "Job has no work to do."
        };

        logger.warn(err)

        throw err;
    }
}
