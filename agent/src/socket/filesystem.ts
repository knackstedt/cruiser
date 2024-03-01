import { io } from "socket.io-client";
import environment from '../util/environment';
import { getLogger } from '../util/logger';

const logger = getLogger("filesystem");

export const getSocketFilesystem = async () => {
    const socket = io(environment.dotopsUrl, {
        path: "/ws/log-ingest",
        extraHeaders: {}
    });

    await new Promise((res, rej) => {
        socket.on("connection", (socket) => res(socket));
        socket.on("fs:readdir", () => 1
        );
        socket.on("error", (err) => rej(err));
    });
}
