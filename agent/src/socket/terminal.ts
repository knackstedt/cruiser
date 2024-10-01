import os from "os";
import * as pty from "node-pty";
import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';
import { environment } from '../util/environment';
import { Span } from '@opentelemetry/api';
import { logger } from '../util/logger';

import { command } from 'execa';

export const CreateTerminalSocketServer = async (parentSpan: Span, socket: Socket) => {

    // Make an attempt to get a compatible PTY program.
    const shell = os.platform() == "win32"
        ? "powershell.exe"
        : await command("which zsh").then(r => r.stdout)
        ? "zsh"
        : await command("which fish").then(r => r.stdout)
        ? "fish"
        : await command("which bash").then(r => r.stdout)
        ? "bash"
        : await command("which ash").then(r => r.stdout)
        ? "ash"
        : "sh";

    let ptyProcess: pty.IPty;

    const uid = ulid();

    socket.on("ssh:launch", (data) => {

        // TODO: restore history on reconnect...
        let history = [];
        try {
            const ptyArgs: pty.IPtyForkOptions = {
                name: "xterm-color",
                cwd: environment.buildDir,
                env: {
                    ...process.env,
                    "COLORTERM": "truecolor"
                },
                cols: 80,
                rows: 40
            };
            ptyProcess = pty.spawn(shell, [], ptyArgs);
        }
        catch (ex) {
            logger.warn({
                msg: "Failed to spawn PTY",
                properties: {
                    stack: ex.stack,
                    message: ex.message ?? ex.title ?? ex.name
                }
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
