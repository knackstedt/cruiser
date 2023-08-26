import { Server, Socket } from "socket.io";
import si from 'systeminformation';

export class MetricSocketService {
    constructor(server) {

        const io = new Server(server, {
            path: "/ws/metrics.io"
        });

        // "connection" event happens when any client connects to this io instance.
        io.on("connection", socket => {
            let intervals = []

            // Create a new pty service when client connects.
            // console.log("socket has been bound")
            // intervals.push(setInterval(async() => {

            //     // Send dynamic data
            //     const data = await si.getDynamicData();
            //     socket.emit("metrics", data);
            // }, 2500));

            // Send initial data
            si.getStaticData().then(data => socket.emit("static", data));
            si.getDynamicData().then(data => socket.emit("metrics", data));

            // CPU Metrics
            intervals.push(setInterval(() => {
                si.currentLoad().then(data => socket.emit("cpumetrics", data));
            }, 250));

            // Memory Metrics
            intervals.push(setInterval(() => {
                si.mem().then(data => socket.emit("memmetrics", data));
            }, 250));

            intervals.push(setInterval(() => {
                si.networkStats().then(data => socket.emit("networkmetrics", data));
            }, 250));

            socket.on("disconnect", () => {
                intervals.forEach(i => clearInterval(i));
            });
        });
    }
}
