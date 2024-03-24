import { api } from '../util/axios';
import { JobDefinition, PipelineDefinition, PipelineInstance, StageDefinition } from '../../types/pipeline';
import { logger } from '../util/logger';
import environment from '../util/environment';
import { JobInstance } from '../../types/agent-task';

export const getConfig = async (taskId) => {
    const { data: kubeTask } = await api.get(`/api/odata/${taskId}`);

    if (!kubeTask) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        process.exit(1);
    }

    const { data: pipelineInstance } = await api.get<PipelineInstance>(`/api/odata/${kubeTask.pipeline_instance}`);
    const { data: pipeline } = await api.get<PipelineDefinition>(`/api/odata/${kubeTask.pipeline}`);
    const { data: stage } = await api.get<StageDefinition>(`/api/odata/${kubeTask.stage}`);
    const { data: jobInstance } = await api.get<JobInstance>(`/api/odata/${environment.jobInstanceId}`)

    const job = pipeline?.stages?.map(s => s.jobs).flat().find(j => j.id == kubeTask.job);

    if (!pipeline || !job) {
        if (!pipeline)
            logger.fatal({ msg: `Job does not have reference to Pipeline`, jobInstance: kubeTask });
        if (!job)
            logger.fatal({ msg: `Job does not have reference to Job`, jobInstance: kubeTask });

        await api.patch(`/api/odata/${taskId}`, { state: "failed" })
            .catch(ex => void 0 /* NOP */);

        process.exit(1);
    }

    return {
        pipelineInstance,
        pipeline,
        stage,
        job,
        kubeTask,
        jobInstance
    }
}
