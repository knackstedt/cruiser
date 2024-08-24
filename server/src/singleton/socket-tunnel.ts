import { Server, Socket } from "socket.io";
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition } from '../types/pipeline';
import { SessionMiddleware } from '../middleware/session';
import { Session, SessionData } from 'express-session';
import { CheckJobToken } from '../util/token-cache';
import { JobInstance } from '../types/agent-task';

export class SocketTunnelService {

    buffer: any[];

    connectedClients: {
        [key: string]: {
            id: string,
            socket: Socket,
            watchJobs: string[]
        }
    } = {};
    connectedSources: {
        [key: string]: {
            id: string,
            socket: Socket,
            metadata?: {
                jobInstance: JobInstance,
                pipeline: PipelineDefinition,
            }
        }
    } = {};

    constructor(
        private server,

    ) {
        this.startClientService();
        this.startSourceService();
    }

    private startClientService() {
        const io = new Server(this.server, {
            path: "/ws/socket-tunnel",
            maxHttpBufferSize: 1024**3
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

            const id = ulid();

            const client = this.connectedClients[id] = {
                id,
                socket,
                watchJobs: []
            };

            socket.on("$connect", async ({ jobInstanceId }: { jobInstanceId: string }) => {
                if (!client.watchJobs.includes(jobInstanceId))
                    client.watchJobs.push(jobInstanceId);

                // Find the right container to connect
                const { socket: srcSocket } = (Object.values(this.connectedSources)
                    .find(source => source.metadata?.jobInstance?.id == jobInstanceId) ?? {});

                if (srcSocket) {
                    this.connectClientToSource(socket, srcSocket);
                }
            });

            socket.on("disconnect", () => delete this.connectedClients[id]);
        });
    }

    // Agents will connect here and load data into the streams
    private startSourceService() {
        // TODO: restrict this to only allow connections from the internal cluster or known agents?
        const io = new Server(this.server, {
            path: "/ws/socket-tunnel-internal",
            maxHttpBufferSize: 1024 ** 3
        });

        io.on("connection", async socket => {
            const cruiserToken = socket.handshake.auth["X-Cruiser-Token"];
            if (!cruiserToken) {
                socket.disconnect();
                return;
            }

            const isAuthenticated = await CheckJobToken(cruiserToken);

            if (!isAuthenticated) {
                socket.disconnect();
                return;
            }
            const id = ulid();

            this.connectedSources[id] = { socket, id };
            socket.on("disconnect", () => {
                const oldSrc = this.connectedSources[id];
                oldSrc.socket.disconnect();

                delete this.connectedSources[id];
            });

            socket.on("$metadata", (data: { jobInstance: JobInstance, pipeline: PipelineDefinition }) => {

                // Remove any old entries that haven't been disconnected
                Object.entries(this.connectedSources).forEach(([idx, source]) => {
                    // Check if we have a socket connection to replace.
                    if (!(source.metadata?.jobInstance?.id == data?.jobInstance?.id)) return;

                    const oldSrc = this.connectedSources[idx];
                    oldSrc.socket.disconnect();

                    delete this.connectedSources[idx];
                })

                this.connectedSources[id].metadata = data;
                this.connectToWaitingClients(id);
            });
            socket.emit("$get-metadata", { data: id });
        });
    }

    private connectToWaitingClients(id: string) {
        const { metadata, socket } = this.connectedSources[id];

        Object.values(this.connectedClients).forEach(client => {
            if (client.watchJobs.includes(metadata.jobInstance.id)) {
                this.connectClientToSource(socket, client.socket);
            }
        })
    }

    private connectClientToSource(clientSocket: Socket, sourceSocket: Socket) {
        clientSocket.emit("$connected");

        // TODO: Should we intercept connect/disconnect?
        // @ts-ignore
        sourceSocket.onAny((...args) => clientSocket.emit(...args));
        // @ts-ignore
        clientSocket.onAny((...args) => sourceSocket.emit(...args));
    }
}
