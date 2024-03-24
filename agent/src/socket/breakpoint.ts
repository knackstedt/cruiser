import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../../types/agent-task';
import { api } from '../util/axios';
import { TaskDefinition, TaskGroupDefinition } from '../../types/pipeline';
import { getSocketLogger } from './logger';
import environment from '../util/environment';

const breakpoints: {
    [key: string]: {
        resolve: Function,
        reject: Function,
        id: string,
        task: TaskDefinition,
        taskGroup: TaskGroupDefinition
    }
} = {};
let _socket: Socket;

// This will always execute before `TripBreakpoint`.
export const BindSocketBreakpoint = async (
    socket: Socket,
    logger: Awaited<ReturnType<typeof getSocketLogger>>
) => {
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

    socket.on("breakpoint:get-list", () => {
        socket.emit("breakpoint:list", {
            breakpoints: Object.values(breakpoints)
                .map(v => ({...v, resolve: undefined, reject: undefined}))
        });
    });

    // A halt message will kill the job -- full stop.
    socket.on("breakpoint:halt", async () => {
        logger.info({
            msg: "User requested halt of job. Halting."
        });

        await api.patch(`/api/odata/${environment.jobInstanceId}`, {
            state: "building",
            breakpointTask: null,
            breakpointTaskGroup: null
        })

        process.exit(0);
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
            reject: rej,
            id: uid,
            task,
            taskGroup
        }
    });
}
