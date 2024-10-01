import { Server, Socket } from "socket.io";
import { SessionMiddleware } from '../middleware/session';
import { SessionData } from 'express-session';
import { afterDatabaseConnected, db } from '../util/db';
import { PipelineInstance } from '../types/pipeline';

export class SocketLiveService {

    constructor(private server) {
        const io = new Server(this.server, {
            path: "/socket/live-socket",
            maxHttpBufferSize: 1024 ** 3
        });
        io.engine.use(SessionMiddleware);
        io.engine.use((req, res, next) => {
            if (
                !req.session?.profile?.roles ||
                !(
                    req.session.profile.roles.includes("administrator") ||
                    req.session.profile.roles.includes("manager") ||
                    req.session.profile.roles.includes("user")
                )
            ) {
                return next(404);
            }
            next();
        });
        const activeSockets: Socket[] = [];

        afterDatabaseConnected(() => {
            const watchPipelines = () =>
                db.live("pipeline", data =>
                    data.action == "CLOSE"
                        ? watchPipelines()
                        : activeSockets.forEach(s => s.emit("live:pipeline", data)
                    )
                );

            const watchPipelineInstances = () =>
                db.live<PipelineInstance>("pipeline_instance", data => {
                    if (data.action == "CLOSE")
                        return watchPipelineInstances();

                    db.query<[[PipelineInstance]]>(`select * from '${data.result.id}' fetch status.jobInstances`)
                        .then(([[instance]]) => {
                            data.result = instance;
                            activeSockets.forEach(s => s.emit("live:pipeline_instance", data));
                        })
                    .catch(err => { /* TODO */})
                });

            const watchJobInstances = () =>
                db.live("job_instance", data =>
                    data.action == "CLOSE"
                        ? watchJobInstances()
                        : activeSockets.forEach(s => s.emit("live:job_instance", data)
                    )
                );

            watchPipelines();
            watchPipelineInstances();
            watchJobInstances();


            io.on("connection", socket => {
                const req = socket.request;
                const session: SessionData = req['session'];

                activeSockets.push(socket);

                socket.on("disconnect", () => {
                    activeSockets.splice(activeSockets.indexOf(socket), 1);
                });
                socket.on("$connected", () => {
                    // TODO: Filter pipeline instance and job instance to the current UI view.
                    db.select("pipeline").then(results => {
                        results.forEach(result => socket.emit("live:pipeline", { action: "UPDATE", result }));
                    })
                    db.select("pipeline_instance").then(results => {
                        results.forEach(result => socket.emit("live:pipeline_instance", { action: "UPDATE", result }));
                    })
                    db.select("job_instance").then(results => {
                        results.forEach(result => socket.emit("live:job_instance", { action: "UPDATE", result }));
                    })
                });
            });
        });
    }
}
