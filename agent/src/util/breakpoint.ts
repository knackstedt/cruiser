import { api } from './axios';
import { sleep } from './sleep';
import environment from './environment';

export const TripBreakpoint = async (taskId: string) => {

    // Tell the server that we're stuck on a breakpoint
    await api.patch(`/api/odata/${taskId}`, { state: "breakpoint" });

    // Keep running until we break out or throw an exception
    // Should this occur indefinitely, the containing job will
    // expire.
    while (true) {
        await sleep(environment.freezePollInterval);

        const { data } = await api.get(`/api/odata/${taskId}`)

        // If the freeze point has been removed, resume the pipeline
        if (!data) {
            throw new Error("FATAL: Cannot get id")
        };
    }
}
