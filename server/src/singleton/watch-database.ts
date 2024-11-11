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
                db.live("pipeline", (action, result) =>
                    action == "CLOSE"
                        ? watchPipelines()
                        : activeSockets.forEach(s => s.emit("live:pipeline", { action, result })
                    )
                );

            const watchPipelineInstances = () =>
                db.live<PipelineInstance>("pipeline_instance", (action, result) => {
                    if (action == "CLOSE")
                        return watchPipelineInstances();

                    db.query<[[PipelineInstance]]>(`select * from $id fetch status.jobInstances`, { id: (result as any).id })
                        .then(([[instance]]) => {
                            result = instance;
                            activeSockets.forEach(s => s.emit("live:pipeline_instance", { action, result }));
                        })
                    .catch(err => { /* TODO */})
                });

            const watchJobInstances = () =>
                db.live("job_instance", (action, result) =>
                    action == "CLOSE"
                        ? watchJobInstances()
                        : activeSockets.forEach(s => s.emit("live:job_instance", { action, result })
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
                    // TODO: this seems stupid. This causes all old job instances and pipeline instances to be fed to the
                    // client even if it's not rendering them. It's probably better to simply update the containing pipeline
                    // stats and let change detection do it's thing to auto refresh the list of pipeline instances.

                    // TODO: Filter pipeline instance and job instance to the current UI view.
                    db.select("pipeline").then(results => {
                        results.forEach(result => socket.emit("live:pipeline", { action: "UPDATE", result }));
                    })
                    db.query<[PipelineInstance[]]>("SELECT * FROM pipeline_instance FETCH status.jobInstances").then(([results]) => {
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
