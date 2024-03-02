import { api } from '../util/axios';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';

export const getConfig = async (taskId, logger) => {
    const { data: kubeTask } = await api.get(`/api/odata/${taskId}`);

    if (!kubeTask) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        process.exit(1);
    }

    const { data: pipeline } = await api.get<PipelineDefinition>(`/api/odata/${kubeTask.pipeline}`);

    const job = pipeline.stages.map(s => s.jobs).flat().find(j => j.id == kubeTask.job);

    if (!pipeline || !job) {
        if (!pipeline)
            logger.fatal({ msg: `Job does not have reference to Pipeline`, jobInstance: kubeTask });
        if (!job)
            logger.fatal({ msg: `Job does not have reference to Job`, jobInstance: kubeTask });

        await api.patch(`/api/odata/${taskId}`, { state: "failed" })
            .catch(ex => void 0 /* NOP */);

        process.exit(1);
    }

    logger.socket.emit("$metadata", {
        pipeline,
        job
    });

    return {
        pipeline,
        job,
        kubeTask
    }
}
