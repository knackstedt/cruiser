import { io } from 'socket.io-client';
import si from 'systeminformation';
import {environment} from '../util/environment';
import { getLogger } from '../util/logger';

const logger = getLogger("metrics");

export const getSocketMetrics = async () => {
    const socket = io(environment.cruiserUrl, {
        path: "/ws/socket-tunnel-internal",
        extraHeaders: {
            "X-Cruiser-Token": environment.cruiserToken
        }
    });

    // "connection" event happens when any client connects to this io instance.
    socket.on("connection", socket => {
        let intervals = [];

        // Create a new pty service when client connects.
        // console.log("socket has been bound")
        // intervals.push(setInterval(async() => {

        //     // Send dynamic data
        //     const data = await si.getDynamicData();
        //     socket.emit("metrics", data);
        // }, 2500));

        // Send initial data
        si.getStaticData().then(data => socket.emit("metrics:static", data));
        si.getDynamicData().then(data => socket.emit("metrics:metrics", data));

        // CPU Metrics
        intervals.push(setInterval(() => {
            si.currentLoad().then(data => socket.emit("metrics:cpumetrics", data));
        }, 250));

        // Memory Metrics
        intervals.push(setInterval(() => {
            si.mem().then(data => socket.emit("metrics:memmetrics", data));
        }, 250));

        intervals.push(setInterval(() => {
            si.networkStats().then(data => socket.emit("metrics:networkmetrics", data));
        }, 250));

        socket.on("disconnect", () => {
            intervals.forEach(i => clearInterval(i));
        });
    });
}
