import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../types/agent-task';
import { api } from '../util/axios';
import { TaskDefinition, TaskGroupDefinition } from '../types/pipeline';
import { CreateLoggerSocketServer } from './logger';
import { environment } from '../util/environment';
import { Span } from '@opentelemetry/api';

const breakpoints: {
    [key: string]: {
        resolve: Function,
        reject: Function,
        id: string,
        task: TaskDefinition,
        taskGroup: TaskGroupDefinition,
        allowRetry: boolean;
    };
} = {};
let _socket: Socket;

// This will always execute before `TripBreakpoint`.
export const CreateBreakpointSocketServer = async (
    span: Span,
    socket: Socket,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    _socket = socket;

    socket.on("breakpoint:resume", ({ id, retry }: { id: string, retry: boolean; }) => {
        api.patch(span, `/api/odata/${jobInstance.id}`, {
            state: "building",
            breakpointTask: null,
            breakpointTaskGroup: null
        })
            .then(() => {
                const breakpoint = breakpoints[id];
                breakpoint?.resolve(retry);
                breakpoints[id] = undefined;
            });
    });

    socket.on("breakpoint:get-list", () => {
        socket.emit("breakpoint:list", {
            breakpoints: Object.values(breakpoints)
                .map(v => ({ ...v, resolve: undefined, reject: undefined }))
                .filter(v => !!v.id)
        });
    });

    return socket;
};

export const TripBreakpoint = async (
    span: Span,
    jobInstance: JobInstance,
    allowRetry: boolean,
    taskGroup?: TaskGroupDefinition,
    task?: TaskDefinition
) => {
    const uid = ulid();
try {

    // This seems to be puking socket hang-up messages...
    await api.patch(span, `/api/odata/${jobInstance.id}`, { state: "frozen" })
        .catch(ex => {
            // Why the hell is this socket breaking?!
            console.error(ex);
        })

    return new Promise<boolean>((res, rej) => {
        breakpoints[uid] = {
            resolve: res,
            reject: rej,
            id: uid,
            task,
            taskGroup,
            allowRetry
        };

        _socket.emit("breakpoint:list", {
            breakpoints: Object.values(breakpoints)
                .map(v => ({ ...v, resolve: undefined, reject: undefined }))
                .filter(v => !!v.id)
        });
    });
}
catch(ex) {
    debugger;
}
return null;
};
