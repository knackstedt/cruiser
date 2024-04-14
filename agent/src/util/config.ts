import { api } from '../util/axios';
import { PipelineInstance } from '../types/pipeline';
import { logger } from '../util/logger';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';

export const getConfig = async (taskId) => {

    const { data: jobInstance } = await api.get<JobInstance>(`/api/odata/${environment.jobInstanceId}`)
    const { data: pipelineInstance } = await api.get<PipelineInstance>(`/api/odata/${jobInstance?.pipeline_instance}`);
    const pipeline = pipelineInstance?.spec;
    const job = pipeline.stages.map(s => s.jobs).flat().find(j => j.id == jobInstance?.job);
    const stage = pipeline.stages.find(s => s.id == jobInstance?.stage);

    // Check that all of the required config items can be resolved
    try {
        if (!jobInstance) throw { msg: `Job does not have reference to JobInstance`, jobInstance };
        if (!pipelineInstance) throw { msg: `Job does not have reference to PipelineInstance`, jobInstance };
        if (!pipeline) throw { msg: `Job does not have reference to Pipeline`, jobInstance };
        if (!stage) throw { msg: `Job does not have reference to Stage`, jobInstance };
        if (!job) throw { msg: `Job does not have reference to Job`, jobInstance };
    }
    catch(err) {
        logger.fatal(err);
        await api.patch(`/api/odata/${taskId}`, { state: "failed" })
            .catch(ex => void 0 /* NOP */);

        process.exit(1);
    }

    return {
        pipelineInstance,
        pipeline,
        stage,
        job,
        jobInstance
    }
}
