import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../types/agent-task';
import { api } from '../util/axios';
import { TaskDefinition, TaskGroupDefinition } from '../types/pipeline';
import { context, Span, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('agent-breakpoint');

const breakpoints: {
    [key: string]: {
        resolve: Function,
        reject: Function,
        span: Span,
        id: string,
        task: TaskDefinition,
        taskGroup: TaskGroupDefinition,
        allowRetry: boolean;
        allowSkip: boolean
    };
} = {};
let _socket: Socket;

const getBreakpoints = () => {
    return Object.values(breakpoints)
        .map(v => ({ ...v, span: undefined, resolve: undefined, reject: undefined }))
        .filter(v => !!v.id);
}

// This will always execute before `TripBreakpoint`.
export const CreateBreakpointSocketServer = async (
    socket: Socket,
    jobInstance: JobInstance
) => {
    _socket = socket;

    socket.on("breakpoint:resume", ({ id, action }: { id: string, action?: number; }) => {
        const breakpoint = breakpoints[id];

        if (!breakpoint) {
            debugger;
            return;
        }

        const span = breakpoint.span;

        span.addEvent("Breakpoint:Resume", { uid: id });
        api.patch(span, `/api/odata/${jobInstance.id}`, {
            state: "building",
            breakpointTask: null,
            breakpointTaskGroup: null
        })
            .then(() => {
                breakpoint.resolve(action);
                breakpoints[id] = undefined;
                socket.emit("breakpoint:list", { breakpoints: getBreakpoints() });
            });
    });

    socket.on("breakpoint:get-list", () => {
        socket.emit("breakpoint:list", { breakpoints: getBreakpoints() });
    });

    return socket;
};

export const TripBreakpoint = async (
    parentSpan: Span,
    jobInstance: JobInstance,
    allowRetry: boolean,
    allowSkip: boolean,
    taskGroup?: TaskGroupDefinition,
    task?: TaskDefinition,
    uid = ulid()
) => {
    parentSpan.addEvent("Breakpoint:Trip", {
        uid,
        task: task?.id,
        taskGroup: taskGroup?.id
    });

    const ctx = trace.setSpan(context.active(), parentSpan);
    return await tracer.startActiveSpan("Task", undefined, ctx, async span => {
        try {
            // This seems to be puking socket hang-up messages...
            await api.patch(span, `/api/odata/${jobInstance.id}`, { state: "frozen" })
                .catch(ex => {
                    // Why the hell is this socket breaking?!
                    console.error(ex);
                })

            // resolve with 0 to not retry the task
            // resolve with 1 to retry the task
            // resolve with 2 to retry the task and break on the next task
            return await new Promise<0|1|2>((res, rej) => {
                breakpoints[uid] = {
                    resolve: res,
                    reject: rej,
                    span,
                    id: uid,
                    task,
                    taskGroup,
                    allowRetry,
                    allowSkip
                };

                _socket.emit("breakpoint:list", { breakpoints: getBreakpoints() });
            });
        }
        catch(ex) {
            debugger;
        }
        return 0;
    });
};
