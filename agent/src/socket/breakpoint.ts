import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../types/agent-task';
import { api } from '../util/axios';
import { TaskDefinition, TaskGroupDefinition } from '../types/pipeline';
import { CreateLoggerSocketServer } from './logger';
import {environment} from '../util/environment';
import { Span } from '@opentelemetry/api';

const breakpoints: {
    [key: string]: {
        resolve: Function,
        reject: Function,
        id: string,
        task: TaskDefinition,
        taskGroup: TaskGroupDefinition,
        allowRetry: boolean,
        jobInstance: JobInstance,
        span: Span
    }
} = {};
let _socket: Socket;

// This will always execute before `TripBreakpoint`.
export const CreateBreakpointSocketServer = async (
    parentSpan: Span,
    socket: Socket,
    jobInstance: JobInstance,
    logger: Awaited<ReturnType<typeof CreateLoggerSocketServer>>
) => {
    _socket = socket;

    socket.on("breakpoint:resume", ({ id, retry }: { id: string, retry: boolean }) => {
        parentSpan.addEvent("breakpoint:resume", { breakpoint: id });
        const breakpoint = breakpoints[id];
        const span = breakpoint.span;
        span.addEvent("breakpoint:resume");

        api.patch(parentSpan, `/api/odata/${jobInstance.id}`, {
            state: breakpoint.jobInstance.state,
            breakpointTask: null,
            breakpointTaskGroup: null
        })
        .then(() => {
            breakpoint?.resolve(retry);
            breakpoints[id] = undefined;
        })
    });

    socket.on("breakpoint:get-list", () => {
        socket.emit("breakpoint:list", {
            breakpoints: Object.values(breakpoints)
                .map(v => ({...v, resolve: undefined, reject: undefined}))
                .filter(v => !!v.id)
        });
    });

    return socket;
}

export const TripBreakpoint = async (
    span: Span,
    jobInstance: JobInstance,
    allowRetry: boolean,
    taskGroup?: TaskGroupDefinition,
    task?: TaskDefinition
) => {
    const uid = ulid();
    span.addEvent("breakpoint:trip", { breakpoint: uid });

    const { data } = await api.get(span, `/api/odata/${jobInstance.id}`);
    await api.patch(span, `/api/odata/${jobInstance.id}`, { state: "frozen" });

    return new Promise<boolean>((res, rej) => {
        breakpoints[uid] = {
            resolve: res,
            reject: rej,
            id: uid,
            task,
            taskGroup,
            allowRetry,
            jobInstance: data as any,
            span
        };

        _socket.emit("breakpoint:list", {
            breakpoints: Object.values(breakpoints)
                .map(v => ({ ...v, resolve: undefined, reject: undefined }))
                .filter(v => !!v.id)
        });
    });
}
