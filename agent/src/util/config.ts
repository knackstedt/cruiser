import { api } from '../util/axios';
import { PipelineInstance } from '../types/pipeline';
import { logger } from '../util/logger';
import { environment } from '../util/environment';
import { JobInstance } from '../types/agent-task';
import { context, Span, trace } from '@opentelemetry/api';
import { OpenTelemetry } from './instrumentation';

const tracer = trace.getTracer('agent-config');

export const getConfig = async (parentSpan: Span, taskId) => {

    const ctx = trace.setSpan(context.active(), parentSpan);
    return tracer.startActiveSpan("GetConfiguration", undefined, ctx, async span => {

        const { data: jobInstance } = await api.get<JobInstance>(span, `/api/odata/${environment.jobInstanceId}`)
        const { data: pipelineInstance } = await api.get<PipelineInstance>(span, `/api/odata/${jobInstance?.pipeline_instance}`);
        const pipeline = pipelineInstance?.spec;
        const stage = pipeline.stages.find(s => s.id == jobInstance?.stage);
        const job = stage.jobs.find(j => j.id == jobInstance?.job);

        span.setAttributes({
            "jobInstance.id": jobInstance.id,
            "pipeline.id": pipeline.id,
            "pipelineInstance.id": pipelineInstance.id,
            "stage.id": stage.id,
            "job.id": job.id
        });

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
            await api.patch(span, `/api/odata/${taskId}`, { state: "failed" })
                .catch(ex => void 0 /* NOP */);

            span.end();
            parentSpan.end();
            await OpenTelemetry?.exporter.shutdown();
            process.exit(1);
        }

        span.end();

        return {
            pipelineInstance,
            pipeline,
            stage,
            job,
            jobInstance
        }
    })
}
