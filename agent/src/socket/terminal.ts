import os from "os";
import * as pty from "node-pty";
import { Socket, io } from "socket.io-client";
import { ulid } from 'ulidx';

export const getSocketTerminal = async (socket: Socket) => {

    let ptyProcess: pty.IPty;
    let ptyArgs;
    const shell = os.platform() == "win32" ? "powershell.exe" : "bash";
    let uid = ulid();

    socket.on("ssh:launch", (data) => {
        try {
            ptyArgs = {
                name: "xterm-color",
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    "COLORTERM": "truecolor"
                },
            };
            ptyProcess = pty.spawn(shell, [], ptyArgs);
        }
        catch (ex) {
            socket.emit("ssh:fatal", ex);
        }

        socket.emit("ssh:started", { id: uid });

        ptyProcess.onData(data => socket.emit("ssh:output", data));
        ptyProcess.onExit(e => socket.emit("ssh:exit", e));
    });

    socket.on("disconnect", () => {
        // TODO: Should we let this live for 5
        // minutes before killing it to allow users
        // to reconnect?
        ptyProcess.kill();
    });

    socket.on("ssh:exit", () => ptyProcess.kill());
    socket.on("ssh:input", ({ input, id }) => {
        if (!ptyProcess || id != uid) {
            socket.emit("ssh:reconnect");
        }
        else {
            ptyProcess?.write(input);
        }
    });
    socket.on("ssh:resize", ({ rows, cols }) => ptyProcess.resize(cols, rows));

    return socket;
}
