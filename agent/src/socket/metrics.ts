import { io, Socket } from 'socket.io-client';
import si from 'systeminformation';
import {environment} from '../util/environment';
import { getLogger } from '../util/logger';

const cpuInterval = environment.agent_metric_cpu_interval;
const menInterval = environment.agent_metric_mem_interval;
const netInterval = environment.agent_metric_net_interval;

const logger = getLogger("metrics");

export const CreateMetricsSocketServer = async (socket: Socket) => {
    const sockets: Socket[] = [];

    // Send initial data
    // si.getStaticData().then(data => socket.emit("metrics:static", data));
    // si.getDynamicData().then(data => socket.emit("metrics:metrics", data));

    setInterval(() => si.currentLoad().then(data =>
        sockets.forEach(socket => socket.emit("metrics:cpu", data))
    ), cpuInterval);

    setInterval(() => si.mem().then(data =>
        sockets.forEach(socket => socket.emit("metrics:mem", data))
    ), menInterval);

    setInterval(() => si.networkStats().then(data =>
        sockets.forEach(socket => socket.emit("metrics:network", data))
    ), netInterval);


    socket.on("connection", socket => {
        let intervals = [];

        // Send initial data
        si.getStaticData().then(data => socket.emit("metrics:static", data));
        // si.getDynamicData().then(data => socket.emit("metrics:metrics", data));

        // CPU Metrics
        sockets.push(socket);

        socket.on("disconnect", () => {
            sockets.splice(socket);
        });
    });
}
