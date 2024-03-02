import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Fetch, VscodeComponent } from '@dotglitch/ngx-common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { JobDefinition } from 'types/pipeline';
import { io, Socket } from 'socket.io-client';
import { ParsedSpan, parse } from 'ansicolor';


@Component({
    selector: 'app-job-log-viewer',
    templateUrl: './job-log-viewer.component.html',
    styleUrl: './job-log-viewer.component.scss',
    imports: [
        NgScrollbarModule,
        ScrollingModule,
        DatePipe,
        NgTemplateOutlet,
        VscodeComponent
    ],
    standalone: true,
})
export class JobLogViewerComponent {

    readonly lineHeight = 19;

    connected = false;
    lines: {
        stream: "stdout" | "stderr",
        time: number;
        data: ParsedSpan[],
    }[];

    public jobInstance;
    public job: JobDefinition

    private socket: Socket;

    private decoder = new TextDecoder();

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly data: any,
        private readonly fetch: Fetch,
        private readonly changeDetector: ChangeDetectorRef
    ) {
        this.jobInstance = data.jobInstance
        this.job = data.job;
    }

    async ngOnInit() {
        // TODO: this double fires because of the tooltip wrapper.
        if (!this.job) return;

        const socket = this.socket = io({
            path: "/ws/socket-tunnel",
            withCredentials: true
        });

        socket.on("connect", () => {
            console.log("CONNECTED");
            this.connected = true;
            this.lines = [];
            socket.emit("$connect", { job: this.job.id });
        });
        socket.on("$connected", () => {
            socket.emit("log:get-history");
        });
        socket.on("disconnect", () => {
            this.connected = false;
        });

        const commitLine = (line: string, stream: "stdout" | "stderr", time = 0) => {
            this.lines.push({
                stream,
                data: parse(line).spans,
                time: time
            });
            this.lines = [...this.lines];
        }

        let stdout = '';
        socket.on("log:stdout", ({data, time}: { data: ArrayBuffer, time: number }) => {
            const text = this.decoder.decode(data);
            console.log({
                data,
                span: parse(text).spans
            });

            if (text.endsWith('\n')) {
                commitLine(stdout + text, "stdout", time);
                stdout = '';
            }
            else {
                stdout = text;
            }
        });

        let stderr = '';
        socket.on("log:stderr", ({data, time}: { data: ArrayBuffer, time: number }) => {
            const text = this.decoder.decode(data);
            console.log({data});

            if (text.endsWith('\n')) {
                commitLine(stderr + text, "stderr", time);
                stderr = '';
            }
            else {
                stderr = text;
            }
        });

        // socket.on("log:block-start", ({data, msg, time}: { data: Object, msg: string, time: number }) => {

        // });
        // socket.on("log:block-end", ({data, msg, time}: { data: Object, msg: string, time: number }) => {

        // });
    }

    ngOnDestroy() {
        this.socket.disconnect();
    }
}
