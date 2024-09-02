import { io, Socket } from 'socket.io-client';
import si from 'systeminformation';
import {environment} from '../util/environment';
import { getLogger } from '../util/logger';

const cpuInterval = environment.agent_metric_cpu_interval;
const menInterval = environment.agent_metric_mem_interval;
const netInterval = environment.agent_metric_net_interval;

// const logger = getLogger("metrics");

export const CreateMetricsSocketServer = async (socket: Socket) => {

    // TODO: cleanup very old records to prevent oom crashing
    // TODO: configure granularity and data aging

    const cpuDatapoints: { time: number, data: si.Systeminformation.CurrentLoadData }[] = [];
    const memDatapoints: { time: number, data: si.Systeminformation.MemData }[] = [];
    const netDatapoints: { time: number, data: si.Systeminformation.NetworkStatsData[] }[] = [];

    setInterval(() => si.currentLoad().then(data => {
        const item = { time: Date.now(), data};
        socket.emit("metrics:cpu", item);
        cpuDatapoints.push(item);
    }), cpuInterval);

    setInterval(() => si.mem().then(data => {
        const item = { time: Date.now(), data};
        socket.emit("metrics:mem", item);
        memDatapoints.push(item);
    }), menInterval);

    setInterval(() => si.networkStats().then(data => {
        const item = { time: Date.now(), data};
        socket.emit("metrics:network", item);
        netDatapoints.push(item);
    }), netInterval);

    socket.on("metrics:get-static", () => {
        // Send initial data
        si.getStaticData().then(data => socket.emit("metrics:static", data));
        si.getDynamicData().then(data => socket.emit("metrics:dynamic", data));
    });

    // Provide historical data on init
    socket.on("metrics:get-history", () => {
        socket.emit("metrics:history", {
            cpu: cpuDatapoints,
            memory: memDatapoints,
            network: netDatapoints
        })
    });
}
