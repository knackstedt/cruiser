import { Server, Socket } from "socket.io";
import { ulid } from 'ulidx';
import { PipelineDefinition } from '../types/pipeline';
import { SessionMiddleware } from '../middleware/session';
import { SessionData } from 'express-session';
import { CheckJobToken } from '../util/token-cache';
import { JobInstance } from '../types/agent-task';
import { LogRecord } from '../types/agent-log';

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
            },
            // Testing: using this as a memory cache for log messages
            // TODO: How much of a memory impact could this have?
            // I expect this would be minimal, but I'm not totally sure.
            logHistory: LogRecord[]
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
            path: "/socket/socket-tunnel",
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

            socket.on("$log:get-history", ({ jobInstanceId }: { jobInstanceId: string }) => {
                const source = (Object.values(this.connectedSources)
                    .find(source => source.metadata?.jobInstance?.id == jobInstanceId) ?? {} as any);

                socket.emit("log:history", source.logHistory);
            });
        });
    }

    // Agents will connect here and load data into the streams
    private startSourceService() {
        const io = new Server(this.server, {
            path: "/socket/socket-tunnel-internal",
            maxHttpBufferSize: 1024 ** 3
        });
        // Only allow connections from agents that were explicitly initialized by the server
        io.engine.use((req, res, next) => {
            // TODO: Create authorization tokens for this purpose.
            const cruiserToken = req.headers["x-cruiser-token"];
            if (!cruiserToken) return next(401);

            req['_agentToken'] = cruiserToken;
            CheckJobToken(cruiserToken)
                .then(hasToken => hasToken ? next() : next(401));
        });


        io.on("connection", async socket => {
            const id = ulid();
            const cruiserToken = socket.handshake.auth["X-Cruiser-Token"];

            // Check if the token matches
            // TODO: check the token against the job instance
            if (!cruiserToken || !await CheckJobToken(cruiserToken)) {
                socket.disconnect();
                return;
            }

            const source = this.connectedSources[id] = { socket, id, logHistory: [] };
            socket.on("disconnect", () => {
                source.socket.disconnect();

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

            socket.on("log:agent", data => {
                source.logHistory.push(data);
            });
            socket.on("log:stdout", data => {
                source.logHistory.push(data);
            });
            socket.on("log:stderr", data => {
                source.logHistory.push(data);
            });

            // We reconnected to the agent and it has log history to share with us
            socket.on("log:history-populate", data => {
                source.logHistory = [...data, ...source.logHistory];
                source.logHistory.sort((a,b) => a.time - b.time);
            });
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
