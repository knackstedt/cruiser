import { Server, Socket } from "socket.io";
import { SessionMiddleware } from '../middleware/session';
import { SessionData } from 'express-session';
import { SocketTunnelService } from './socket-tunnel';

export class SocketEventService {

    buffer: any[];

    connectedClients: {
        [key: string]: {
            id: string,
            socket: Socket,
            watchJobs: string[];
        };
    } = {};

    constructor(
        private server,
        private socketTunnel: SocketTunnelService
    ) {
        const io = new Server(this.server, {
            path: "/socket/socket-service",
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

        io.on("connection", socket => {
            const req = socket.request;
            const session: SessionData = req['session'];

            // If we receive a stop job event, we will attempt to end that job
            // via our live websocket connection.
            // TODO: Fallback to murdering the job via kubectl
            // also, should this controller be here or elsewhere?
            socket.on("$stop-job", async ({ jobInstanceId }: { jobInstanceId: string; }) => {
                const { socket } = Object.values(this.socketTunnel.connectedSources)
                    .find(e => e.metadata?.jobInstance.id == jobInstanceId) || {};

                socket?.emit("$stop-job");
            });
        });
    }
}
