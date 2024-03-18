import { api } from '../util/axios';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';
import { logger } from '../util/logger';
import environment from '../util/environment';
import { JobInstance } from '../../types/agent-task';

export const getConfig = async (taskId) => {
    const { data: kubeTask } = await api.get(`/api/odata/${taskId}`);

    if (!kubeTask) {
        logger.fatal({ msg: `Failed to resolve ${taskId}` });
        process.exit(1);
    }

    const { data: pipeline } = await api.get<PipelineDefinition>(`/api/odata/${kubeTask.pipeline}`);

    const job = pipeline.stages.map(s => s.jobs).flat().find(j => j.id == kubeTask.job);

    const { data: jobInstance } = await api.get<JobInstance>(`/api/odata/job_instance:${environment.agentId}`)

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
        pipeline,
        job,
        kubeTask,
        jobInstance
    }
}
