import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../../types/agent-task';
import { api } from '../util/axios';
import { TaskDefinition, TaskGroupDefinition } from '../../types/pipeline';

const breakpoints: { [key: string]: { resolve: Function, reject: Function } } = {};
let _socket: Socket;

// This will always execute before `TripBreakpoint`.
export const BindSocketBreakpoint = async (socket: Socket) => {
    _socket = socket;

    socket.on("breakpoint:resume", ({ id, job, retry }: { id: string, job: string, retry: boolean }) => {
        api.patch(`/api/odata/${job}`, {
            state: "building",
            breakpointTask: null,
            breakpointTaskGroup: null
        })
        .then(() => {
            breakpoints[id]?.resolve(retry)
        })
    });

    return socket;
}

export const TripBreakpoint = async (
    jobInstance: JobInstance,
    allowRetry: boolean,
    taskGroup?: TaskGroupDefinition,
    task?: TaskDefinition
) => {
    const uid = ulid();

    await api.patch(`/api/odata/${jobInstance.id}`, {
        state: "frozen",
        breakpointTask: task,
        breakpointTaskGroup: taskGroup
    });

    _socket.emit("breakpoint:trip", {
        job: jobInstance.id,
        task: task,
        id: uid
    });

    return new Promise((res, rej) => {
        breakpoints[uid] = {
            resolve: res,
            reject: rej
        }
    });
}
