import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { JobInstance } from '../../types/agent-task';

const breakpoints: { [key: string]: { resolve: Function, reject: Function } } = {};
let _socket: Socket;

// This will always execute before `TripBreakpoint`.
export const BindSocketBreakpoint = async (socket: Socket) => {
    _socket = socket;

    socket.on("breakpoint:resume", ({ id, retry }: { id: string, retry: boolean }) => {
        breakpoints[id]?.resolve(retry)
    });

    return socket;
}

export const TripBreakpoint = async (jobInstance: JobInstance, allowRetry = true) => {
    const uid = ulid();

    _socket.emit("breakpoint:trip", {
        job: jobInstance.id,
        task: 1,
        id: uid
    });

    return new Promise((res, rej) => {
        breakpoints[uid] = {
            resolve: res,
            reject: rej
        }
    });
}
