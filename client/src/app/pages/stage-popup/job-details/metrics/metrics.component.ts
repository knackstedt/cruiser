import { Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef, ViewEncapsulation, ViewChildren } from '@angular/core';
import io, { Socket } from "socket.io-client";

import si from 'systeminformation';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LiveGraphComponent } from './live-graph/live-graph.component';
import { CellComponent } from 'tabulator-tables';
import { CommonModule } from '@angular/common';
import { TabulatorComponent } from '@dotglitch/ngx-common';
import { BindSocketLogger } from 'src/app/utils/utils';
import { JobInstance } from 'src/types/agent-task';

export function formatBytes(bytes, decimals = 2) {
    if (!bytes) return '0 Bytes';

    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    try {
        const value = Math.min(100, Math.max(0, bytes / Math.pow(k, i)));
        return `${parseFloat(value.toFixed(dm))} ${sizes[i]}`;
    }
    catch(ex) {
        console.error(ex);
        return 'error';
    }
}

const CpuColors = [
    '#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
    '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
    '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
    '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
    '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
    '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
    '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
    '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
    '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
    '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'
];

const data_interval = 1000;
const timeframe = 60 * 1000;
const items = timeframe / data_interval;
const initialArray = new Array(items+1);

const timeAxis = new Array(items);
for (let i = items-1; i >= 0; i--) {
    timeAxis[i] = Math.floor(i) + " seconds";
}
timeAxis.reverse();

@Component({
    selector: "agent-metrics-monitor",
    templateUrl: './metrics.component.html',
    styleUrls: ['./metrics.component.scss'],
    imports: [
        CommonModule,
        TabulatorComponent,
        MatTabsModule,
        MatIconModule,
        MatButtonModule,
        LiveGraphComponent
    ],
    standalone: true
})
export class AgentMetricsComponent {
    @ViewChild('cpuGraph') cpuGraph: LiveGraphComponent;
    @ViewChild('memGraph') memGraph: LiveGraphComponent;
    @ViewChild('networkGraph') networkGraph: LiveGraphComponent;

    @Input() jobInstance: JobInstance;

    socket: Socket;
    connected = false;

    staticData: si.Systeminformation.StaticData;
    _staticData: any;
    metricData: si.Systeminformation.DynamicData;
    _metricData: any;

    cpuData = [];
    networkData = [];
    memoryData = [{
        label: "Memory",
        color: "#ab1852",
        data: [...initialArray],
        tooltip: { valueFormatter: formatBytes }
    },
    {
        label: "Swap",
        color: "#49a835",
        data: [...initialArray],
        tooltip: { valueFormatter: formatBytes }
    }];

    readonly xaxis = timeAxis;

    constructor(

    ) { }

    async ngOnInit() {


        // If the pipeline is no longer running, attempt to load the logs from
        // the disk
        // if (['finished', 'failed', 'cancelled'].includes(this.jobInstance.state)) {
        //     this.isCompletedRun = true;
        //     const data = await this.fetch.get<string>(`/api/blobstore/log/${this.jobInstance.pipeline}/${this.jobInstance.pipeline_instance}/${this.jobInstance.stage}/${this.jobInstance.job}/${this.jobInstance.id}.log`, { responseType: "text" });
        //     const entries = data.split('\n').map((line, i) => {
        //         if (!line || line.trim().length == 0) return null;

        //         // We will assume all lines that don't start with a curlybrace are stdout/stderr
        //         if (!line.startsWith("{")) {
        //             if (line.startsWith("log:")) {
        //                 const ev = line.slice(0, 10);
        //                 const t = parseInt(line.slice(11, 24));
        //                 const msg = line.slice(25);

        //                 return {
        //                     ev,
        //                     time: t,
        //                     data: {
        //                         data: msg + '\n',
        //                         time: t
        //                     }
        //                 };
        //             }
        //             // We will assume anything outside of the expected format is an error.
        //             return {
        //                 ev: 'log:stderr',
        //                 time: i,
        //                 data: {
        //                     data: line + '\n',
        //                     time: i
        //                 }
        //             };
        //         }
        //         // Try to parse the line, don't explode if a line is messed up.
        //         try { return JSON.parse(line); } catch (err) { return { level: 50, msg: "Failed to deserialize entry", err }; }
        //     }).filter(l => l);

        //     entries.sort((a, b) => a.time > b.time ? 1 : -1);
        //     console.log(entries);
        //     console.time("Parse log history");
        //     const el = entries.length;

        //     const notASwitch = {
        //         "log:stdout": parseStdOut,
        //         "log:stderr": parseStdErr,
        //         "log:agent": parseAgent
        //     };

        //     for (let i = 0; i < el; i++) {
        //         const fn = notASwitch[entries[i].ev];
        //         // if (!fn) console.log(entries[i]);
        //         if (fn) {
        //             fn?.(entries[i].data, false);
        //         }
        //         else {
        //             parseAgent({
        //                 ...entries[i],
        //                 msg: entries[i].msg ?? entries[i].message ?? entries[i].title,
        //                 time: entries[i].time,
        //                 task: null,
        //                 block: null,
        //                 level: entries[i].logLevel,
        //             }, false);
        //         }
        //     }
        //     console.timeEnd("Parse log history");

        //     this.filterLines();
        // }
        // else {
            const socket = this.socket = io({
                path: "/socket/socket-tunnel",
                withCredentials: true
            });

            // BindSocketLogger('metrics', socket);

            socket.on("connect", () => {
                this.cpuData = [];
                this.networkData = [];
                this.memoryData[0].data = [];
                this.memoryData[1].data = [];
                socket.emit("$connect", { jobInstanceId: this.jobInstance.id });
            });

            socket.on("$connected", () => {
                this.connected = true;
                socket.emit("metrics:get-static");
            });

            socket.on("disconnect", () => {
                this.connected = false;
            });

            socket.on("metrics:static", (data: si.Systeminformation.StaticData) => {
                this.staticData = this._staticData = data;
                socket.emit("metrics:get-history");
            });

            socket.on("metrics:dynamic", (data: si.Systeminformation.DynamicData) => {
                this.metricData = this._metricData = data;
            });

            socket.on("metrics:cpu", (data) => this.parseCpuData(data));
            socket.on("metrics:mem", (data) => this.parseMemoryData(data));
            socket.on("metrics:network", (data) => this.parseNetworkData(data));

            socket.on("metrics:history", (data) => {
                // TODO: Ensure the ordering isn't mangled when inserting historical data

                data.cpu.forEach(item => this.parseCpuData(item));
                data.memory.forEach(item => this.parseMemoryData(item));
                data.network.forEach(item => this.parseNetworkData(item));
            });
        // }
    }

    ngOnDestroy() {
        this.socket?.disconnect();
    }

    byteFormatter(cell: CellComponent) {
        return formatBytes(cell.getValue());
    }
    byteFormatterBare(value) {
        return formatBytes(value);
    }
    cpuFormatter(cell: CellComponent) {
        return cell.getValue().toFixed(2);
    }

    parseCpuData({ data, time }: { data: si.Systeminformation.CurrentLoadData, time: number; }) {
        const cpus = data.cpus;
        cpus.forEach((c, i) => {
            if (!this.cpuData[i]) {
                this.cpuData[i] = {
                    label: i,
                    color: CpuColors[i],
                    tooltip: { valueFormatter: value => value?.toFixed(2) + '%'},
                    data: [...initialArray],
                };
            }
            this.cpuData[i].data.push(c.load);

            // remove extra data points
            if (this.cpuData[i].data.length >= items)
                this.cpuData[i].data.splice(0, 1);
        });
        this.cpuGraph?.refresh();
    }

    parseNetworkData({ data, time }: { data: si.Systeminformation.NetworkStatsData[], time: number; }) {
        const interfaces = data;
        interfaces.forEach((c, index) => {
            const i = index*2;
            if (!this.networkData[i]) {
                this.networkData[i] = {
                    label: c.iface + "_up",
                    color: "#ee1d00",
                    tooltip: { valueFormatter: formatBytes },
                    data: [...initialArray],
                };
            }

            if (!this.networkData[i+1]) {
                this.networkData[i+1] = {
                    label: c.iface + "_down",
                    color: "#2d7db3",
                    tooltip: { valueFormatter: formatBytes },
                    data: [...initialArray],
                };
            }

            // TODO: this logic may very well be flawed
            // Most probably, as Inf is returned decently frequently.
            const tx = Math.round(c.tx_bytes / c.tx_sec * data_interval / 1000);
            const rx = Math.round(c.rx_bytes / c.rx_sec * data_interval / 1000);

            this.networkData[i].data.push(!Number.isFinite(tx) ? null : Number.isNaN(tx) ? null : tx);
            this.networkData[i+1].data.push(!Number.isFinite(rx) ? null : Number.isNaN(rx) ? null : rx);

            // remove extra data points
            if (this.networkData[i].data.length >= items)
                this.networkData[i].data.splice(0, 1);
            if (this.networkData[i+1].data.length >= items)
                this.networkData[i+1].data.splice(0, 1);
        });

        this.networkGraph?.refresh();
    }

    parseMemoryData({ data, time } : { data: si.Systeminformation.MemData, time: number }) {
        this.memoryData[0].data.push(data.used);
        this.memoryData[1].data.push(data.swapused);

        // remove extra data points
        if (this.memoryData[0].data.length >= items)
            this.memoryData[0].data.splice(0, 1);
        if (this.memoryData[1].data.length >= items)
            this.memoryData[1].data.splice(0, 1);

        this.memGraph?.refresh();
    }
}
