import { Server, Socket } from "socket.io";
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';

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
                job: JobDefinition,
                pipeline: PipelineDefinition,
            }
        }
    } = {};

    constructor(private server) {
        this.startClientService();
        this.startSourceService();
    }

    private startClientService() {
        const io = new Server(this.server, {
            path: "/ws/socket-tunnel",
            maxHttpBufferSize: 1e8
        });

        io.on("connection", socket => {
            const id = ulid();

            const client = this.connectedClients[id] = {
                id,
                socket,
                watchJobs: []
            };

            socket.on("$connect", async ({ job }: { job: string }) => {
                if (!client.watchJobs.includes(job))
                    client.watchJobs.push(job);

                // Find the right container to connect
                const { socket: srcSocket } = (Object.values(this.connectedSources)
                    .find(source => source.metadata?.job?.id == job) ?? {});

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
            path: "/ws/socket-tunnel-internal"
        });

        io.on("connection", socket => {
            const id = ulid();

            this.connectedSources[id] = { socket, id };

            socket.on("$metadata", (data) => {
                this.connectedSources[id].metadata = data;
                this.connectToWaitingClients(id);
            });
            socket.on("disconnect", () => delete this.connectedSources[id]);
        });
    }

    private connectToWaitingClients(id: string) {
        const { metadata, socket } = this.connectedSources[id];

        Object.values(this.connectedClients).forEach(client => {
            if (client.watchJobs.includes(metadata.job.id)) {
                this.connectClientToSource(socket, client.socket);
            }
        })
    }

    private connectClientToSource(clientSocket, sourceSocket) {
        clientSocket.emit("$connected");

        // TODO: Should we intercept connect/disconnect?
        sourceSocket.onAny((...args) => clientSocket.emit(...args));
    }
}
