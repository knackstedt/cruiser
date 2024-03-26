import { Server, Socket } from "socket.io";
import { sessionHandler } from '../middleware/session';
import { SessionData } from 'express-session';
import { afterDatabaseConnected, db } from '../util/db';

export class SocketLiveService {

    constructor(private server) {
        const io = new Server(this.server, {
            path: "/ws/live-socket",
            maxHttpBufferSize: 1024 ** 3
        });
        io.engine.use(sessionHandler);
        const activeSockets: Socket[] = [];

        afterDatabaseConnected(() => {
            const liveQueries = [
                db.live(
                    "pipeline",
                    data => {
                        activeSockets.forEach(s =>
                            s.emit("live:pipeline", data)
                        )
                    }
                ),
                db.live(
                    "pipeline_instance",
                    data => activeSockets.forEach(s =>
                        s.emit("live:pipeline_instance", data)
                    )
                ),
                db.live(
                    "job_instance",
                    data => activeSockets.forEach(s =>
                        s.emit("live:job_instance", data)
                    )
                )
            ]

            io.on("connection", socket => {
                const req = socket.request;
                const session: SessionData = req['session'];

                if (
                    !session?.profile?.roles ||
                    !(
                        session.profile.roles.includes("administrator") ||
                        session.profile.roles.includes("manager") ||
                        session.profile.roles.includes("user")
                    )
                ) {
                    // If the request isn't authenticated, purge it.
                    socket.emit("error", { status: 403, message: "Forbidden" });
                    socket.disconnect(true);
                    return;
                }

                activeSockets.push(socket);

                socket.on("disconnect", () => {
                    activeSockets.splice(activeSockets.indexOf(socket), 1);
                });
            });
        });
    }
}
