import { Server, Socket } from "socket.io";
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition } from '../../types/pipeline';

export class SocketTunnelService {

    buffer: any[];

    connectedClients: { [key: string]: Socket} = {};
    connectedSources: {
        [key: string]: {
        socket: Socket,
        metadata?: {
            job: JobDefinition,
            pipeline: PipelineDefinition,
        }
    }} = {};

    constructor(private server) {
        this.startClientService();
        this.startSourceService();
    }

    private startClientService() {
        const io = new Server(this.server, {
            path: "/ws/socket-tunnel"
        });

        io.on("connection", socket => {
            const id = ulid();

            this.connectedClients[id] = socket;

            socket.on("$connect", async (data: { agentId: string }) => {
                // TODO: Find the right container

                const { socket: srcSocket } = this.connectedSources[0];

                srcSocket.onAny(socket.emit);
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

            this.connectedSources[id] = { socket };

            socket.on("$metadata", (data) => this.connectedSources[id].metadata = data);
            socket.on("disconnect", () => delete this.connectedSources[id]);
        });
    }
}
