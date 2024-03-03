import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, NgZone, ViewChild } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NgScrollbar, NgScrollbarModule } from 'ngx-scrollbar';
import { JobDefinition, TaskDefinition } from 'types/pipeline';
import { io, Socket } from 'socket.io-client';
import ansi, { ParsedSpan, parse } from 'ansicolor';
import { darkTheme } from 'client/app/services/theme.service';
import { TooltipDirective } from '@dotglitch/ngx-common';
import { MatCheckboxModule } from '@angular/material/checkbox';

type Line = ({
    stream: "stdout" | "stderr" | "agent",
    fullTime: string;
    time: string;
    data?: ParsedSpan[],
    rendered: boolean;
    index: number,
    marker: boolean,

    state?: string,
    msg?: string,
    block?: "start" | "end",

    _expanded?: boolean;
});

@Component({
    selector: 'app-job-logs',
    templateUrl: './job-logs.component.html',
    styleUrls: ['./job-logs.component.scss'],
    imports: [
        NgTemplateOutlet,
        NgScrollbarModule,
        TooltipDirective,
        MatIconModule,
        MatCheckboxModule
    ],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobLogsComponent {
    @ViewChild(NgScrollbar) scrollbar: NgScrollbar;

    @Input() jobInstance;


    readonly lineHeight = 19;
    readonly bufferLines = 10;

    showStdOut = true;
    showStdErr = true;
    showTimestamps = true;

    connected = false;

    lineCount = 0;
    lines: Line[] = [];
    renderedLines: Line[] = [];


    private socket: Socket;
    private decoder = new TextDecoder();

    constructor(
        private readonly changeDetector: ChangeDetectorRef
    ) {

        this.setColors();
    }

    setColors() {
        // This is following the library doc. (Yes, it's non-standard)
        ansi.rgb = darkTheme;
    }


    async ngOnInit() {
        const socket = this.socket = io({
            path: "/ws/socket-tunnel",
            withCredentials: true
        });

        socket.on("connect", () => {
            this.connected = true;
            this.lines = [];
            socket.emit("$connect", { job: this.jobInstance.job });

            this.changeDetector.detectChanges();
        });
        socket.on("$connected", () => {
            socket.emit("log:get-history");
        });
        socket.on("disconnect", () => {
            this.connected = false;
        });

        socket.on("log:stdout", data => parseStdOut(data));
        socket.on("log:stderr", data => parseStdErr(data));
        socket.on("log:agent", data => parseAgent(data));

        socket.on("log:history", (entries: { ev: string, data: object; }[]) => {
            console.time("Parse log history");
            const el = entries.length;
            for (let i = 0; i < el; i++) {
                entries[i].ev == "log:stdout" && parseStdOut(entries[i].data as any, false);
                entries[i].ev == "log:stderr" && parseStdErr(entries[i].data as any, false);
                entries[i].ev == "log:agent" && parseAgent(entries[i].data as any, false);
            }
            console.timeEnd("Parse log history");
        });


        const commitLine = (line: string, stream: "stdout" | "stderr", time = 0, doCommit = true) => {
            // TODO: save and restore selection...

            const iso = (new Date(time)).toISOString();

            this.lines.push({
                stream,
                data: parse(line).spans,
                fullTime: iso.replace('T', ' '),
                time: iso.replace(/^[^T]+T/, ''),
                rendered: false,
                index: -1,
                marker: false
            });

            if (doCommit) {
                this.render();
            }
        };

        let stdout = '';
        const parseStdOut = ({ data, time }: { data: ArrayBuffer, time: number; }, doCommit = true) => {
            const text = this.decoder.decode(data);

            if (text.endsWith('\n')) {
                commitLine(stdout + text, "stdout", time, doCommit);
                stdout = '';
            }
            else {
                stdout = text;
            }
        };

        let stderr = '';
        const parseStdErr = ({ data, time }: { data: ArrayBuffer, time: number; }, doCommit = true) => {
            const text = this.decoder.decode(data);

            if (text.endsWith('\n')) {
                commitLine(stderr + text, "stderr", time, doCommit);
                stderr = '';
            }
            else {
                stderr = text;
            }
        };

        const parseAgent = (data: { time: number; block: string, msg: string, level: string, command?: string, task: TaskDefinition; }, doCommit = true) => {
            const iso = (new Date(data.time)).toISOString();

            this.lines.push({
                stream: "agent",
                fullTime: iso.replace('T', ' '),
                time: iso.replace(/^[^T]+T/, ''),
                rendered: false,
                index: -1,
                marker: !!data.block,
                block: data.block as any,
                msg: data.msg,
                _expanded: true
            });

            if (doCommit) {
                this.render();
            }
        };
    }

    ngAfterViewInit() {
        const viewport = this.scrollbar.viewport.nativeElement;
        viewport.onscroll = () => {
            this.onScroll(viewport);
        };
    }

    ngOnDestroy() {
        this.socket.disconnect();
    }

    render() {
        this.onScroll(this.scrollbar.viewport.nativeElement);
    }

    onScroll(scroller: HTMLElement) {
        if (!scroller) return;

        const pos = this.scrollbar.viewport.scrollTop;
        // const bounds = scroller.getBoundingClientRect();
        const top = pos;
        const bottom = pos + this.scrollbar.viewport.clientHeight;

        const VIRTUAL_SCROLLING_OVERLAP = this.lineHeight * this.bufferLines;
        // Quickly recalculate the heights of the swimlanes
        let currentY = 0;
        const l = this.lines.length;

        for (let i = 0; i < l; i++) {
            const line = this.lines[i];

            // The swimlane is visible if it's within 500px of the top of the viewport,
            // or if it's within 500px of the bottom of the viewport.
            line.rendered =
                !(currentY + this.lineHeight + VIRTUAL_SCROLLING_OVERLAP < top) &&
                !(currentY - VIRTUAL_SCROLLING_OVERLAP > bottom);
            line.index = i;

            currentY += this.lineHeight;
        }

        this.renderedLines = this.lines.filter(l => l.rendered);

        this.changeDetector.detectChanges();
    }
}
