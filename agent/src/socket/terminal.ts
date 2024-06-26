import os from "os";
import shx from "shelljs";
import * as pty from "node-pty";
import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { environment } from '../util/environment';
import { getSocketLogger } from './logger';

// Make an attempt to get a compatible PTY program.
const shell = os.platform() == "win32"
    ? "powershell.exe"
    : shx.which("bash")
    ? "bash"
    : shx.which("ash")
    ? "ash"
    : shx.which("zsh")
    ? "zsh"
    : shx.which("ksh")
    ? "ksh"
    : "sh";

export const getSocketTerminal = async (socket: Socket, logger: Awaited<ReturnType<typeof getSocketLogger>>) => {

    let ptyProcess: pty.IPty;
    let ptyArgs;

    const uid = ulid();

    socket.on("ssh:launch", (data) => {
        logger.info({
            msg: "Starting PTY",
            data
        });

        // TODO: restore history on reconnect...
        let history = [];
        try {
            ptyArgs = {
                name: "xterm-color",
                cwd: environment.buildDir,
                env: {
                    ...process.env,
                    "COLORTERM": "truecolor"
                },
            };
            ptyProcess = pty.spawn(shell, [], ptyArgs);
        }
        catch (ex) {
            logger.warn({
                msg: "Failed to spawn PTY",
                stack: ex.stack,
                message: ex.message ?? ex.title ?? ex.name
            });
            socket.emit("ssh:fatal", ex);
        }

        socket.emit("ssh:started", { id: uid });

        ptyProcess?.onData(data => socket.emit("ssh:output", history.push(data) && data));
        ptyProcess?.onExit(e => socket.emit("ssh:exit", e));
    });

    socket.on("disconnect", () => {
        // TODO: Should we let this live for 5
        // minutes before killing it to allow users
        // to reconnect?
        ptyProcess?.kill();
    });

    socket.on("ssh:exit", () => ptyProcess?.kill());
    socket.on("ssh:input", ({ input, id }) => {
        if (!ptyProcess || id != uid) {
            socket.emit("ssh:reconnect");
        }
        else {
            ptyProcess?.write(input);
        }
    });
    socket.on("ssh:resize", ({ rows, cols }) => ptyProcess?.resize(cols, rows));

    return socket;
}
