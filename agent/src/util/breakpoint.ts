import { api } from './axios';
import environment from './environment';
import { TaskGroupDefinition } from '../../types/pipeline';
import { JobInstance } from '../../types/agent-task';
import { sleep } from './sleep';

export async function TripBreakpoint({ taskGroup, agentTask }: { taskGroup: TaskGroupDefinition, agentTask: JobInstance; }) {

    await api.patch(`/api/odata/job:${environment.agentId}`, {
        status: "frozen"
    });

    // Keep running until we break out or throw an exception
    // Should this occur indefinitely, the containing job will
    // expire.
    while (true) {
        await sleep(environment.freezePollInterval);

        const { data } = await api.get(`/api/odata/job:${environment.agentId}`);

        // If the freeze point has been removed, resume the pipeline
        if (!data || data.state != "frozen") break;
    }
}
