import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NgScrollbar, NgScrollbarModule } from 'ngx-scrollbar';
import { TaskDefinition } from 'src/types/pipeline';
import { io, Socket } from 'socket.io-client';
import ansi, { ParsedSpan, parse } from 'ansicolor';
import { darkTheme } from 'src/app/services/theme.service';
import { Fetch, TooltipDirective } from '@dotglitch/ngx-common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { JobInstance } from 'src/types/agent-task';
import { MatDialog } from '@angular/material/dialog';
import { BindSocketLogger, ViewJsonInMonacoDialog } from 'src/app/utils/utils';

type Line = ({
    stream: "stdout" | "stderr" | "agent",
    fullTime: string;
    time: string;
    level: "error" | "info" | "warn" | "fatal" | "debug"
    data?: ParsedSpan[],
    rendered: boolean;
    index: number,
    marker: boolean,

    state?: string,
    msg?: string,
    block?: "start" | "end",

    _expanded?: boolean;
    _original?: any
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
        MatCheckboxModule,
        MatInputModule
    ],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobLogsComponent {
    @ViewChild(NgScrollbar) scrollbar: NgScrollbar;
    get scroller() { return this.scrollbar.viewport.nativeElement; }
    @Input() jobInstance: JobInstance;


    readonly lineHeight = 19;
    readonly bufferLines = 10;

    showStdOut = true;
    showStdErr = true;
    showAgent = true;
    showTimestamps = true;
    query = '';

    connected = false;
    isCompletedRun = false;

    lineCount = 0;
    lines: Line[] = [];
    filteredLines: Line[] = [];
    renderedLines: Line[] = [];
    scrollToBottom = true;

    private socket: Socket;
    private decoder = new TextDecoder();

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
        private readonly fetch: Fetch,
        private readonly dialog: MatDialog
    ) {

        this.setColors();
    }

    setColors() {
        // This is following the library doc. (Yes, it's non-standard)
        ansi.rgb = darkTheme;
    }


    async ngOnInit() {
        const commitLine = (line: string, stream: "stdout" | "stderr", time = 0, doCommit = true, data) => {
            // TODO: save and restore selection...

            const iso = (new Date(time)).toISOString();

            line.split('\n').forEach(line => {
                if (line.trim().length == 0) return;

                this.lines.push({
                    stream,
                    fullTime: iso.replace('T', ' x'),
                    time: iso.replace(/^[^T]+T/, ''),
                    level: stream == "stderr" ? "error" : "info",
                    rendered: false,
                    index: -1,
                    marker: false,
                    msg: line,
                    data: parse(line).spans,
                    _original: data
                });
            })

            if (doCommit) {
                this.filterLines();
            }
        };

        let stdout = '';
        const parseStdOut = (args: { data: ArrayBuffer | string, time: number; }, doCommit = true) => {
            const { data, time } = args;
            const text = data instanceof ArrayBuffer ? this.decoder.decode(data) : data;

            stdout += text;
            if (text.endsWith('\n')) {
                commitLine(stdout, "stdout", time, doCommit, data);
                stdout = '';
            }
        };

        let stderr = '';
        const parseStdErr = (args: { data: ArrayBuffer | string, time: number; }, doCommit = true) => {
            const { data, time } = args;
            const text = data instanceof ArrayBuffer ? this.decoder.decode(data) : data;

            stderr += text;

            if (text.endsWith('\n')) {
                commitLine(stderr, "stderr", time, doCommit, data);
                stderr = '';
            }
        };

        const parseAgent = (data: { time: number; block: string, msg: string, level: string, command?: string, task: TaskDefinition; }, doCommit = true) => {
            const iso = (new Date(data.time)).toISOString();

            this.lines.push({
                ...data,
                stream: "agent",
                fullTime: iso.replace('T', ' '),
                time: iso.replace(/^[^T]+T/, ''),
                level: data.level as any,
                rendered: false,
                index: -1,
                marker: !!data.block,
                block: data.block as any,
                msg: data.msg,
                _expanded: true,
                _original: data
            });

            if (doCommit) {
                this.filterLines();
            }
        };

        // If the pipeline is no longer running, attempt to load the logs from
        // the disk
        if (['finished', 'failed', 'cancelled'].includes(this.jobInstance.state)) {
            this.isCompletedRun = true;
            const data = await this.fetch.get<string>(`/api/blobstore/log/${this.jobInstance.pipeline}/${this.jobInstance.pipeline_instance}/${this.jobInstance.stage}/${this.jobInstance.job}/${this.jobInstance.id}.log`, { responseType: "text" });
            const entries = data.split('\n').map((line, i) => {
                if (!line || line.trim().length == 0) return null;

                // We will assume all lines that don't start with a curlybrace are stdout/stderr
                if (!line.startsWith("{")) {
                    if (line.startsWith("log:")) {
                        const ev = line.slice(0,10);
                        const t = parseInt(line.slice(11,24));
                        const msg = line.slice(25);

                        return {
                            ev,
                            time: t,
                            data: {
                                data: msg + '\n',
                                time: t
                            }
                        }
                    }
                    // We will assume anything outside of the expected format is an error.
                    return {
                        ev: 'log:stderr',
                        time: i,
                        data: {
                            data: line + '\n',
                            time: i
                        }
                    }
                }
                // Try to parse the line, don't explode if a line is messed up.
                try { return JSON.parse(line) } catch(err) { return { level: 50, msg: "Failed to deserialize entry", err } }
            }).filter(l => l);

            entries.sort((a,b) => a.time > b.time ? 1 : -1);
            console.log(entries);
            console.time("Parse log history");
            const el = entries.length;

            const notASwitch = {
                "log:stdout": parseStdOut,
                "log:stderr": parseStdErr,
                "log:agent":  parseAgent
            };

            for (let i = 0; i < el; i++) {
                const fn = notASwitch[entries[i].ev];
                // if (!fn) console.log(entries[i]);
                if (fn) {
                    fn?.(entries[i].data, false);
                }
                else {
                    parseAgent({
                        ...entries[i],
                        msg: entries[i].msg ?? entries[i].message ?? entries[i].title,
                        time: entries[i].time,
                        task: null,
                        block: null,
                        level: entries[i].logLevel,
                    }, false);
                }
            }
            console.timeEnd("Parse log history");

            this.filterLines();
        }
        else {
            const socket = this.socket = io({
                path: "/ws/socket-tunnel",
                withCredentials: true
            });
            BindSocketLogger('logs', socket);

            socket.on("connect", () => {
                this.lines = [];
                socket.emit("$connect", { jobInstanceId: this.jobInstance.id });

                this.changeDetector.detectChanges();
            });
            socket.on("$connected", () => {
                this.connected = true;
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

                const notASwitch = {
                    "log:stdout": parseStdOut,
                    "log:stderr": parseStdErr,
                    "log:agent": parseAgent
                }

                for (let i = 0; i < el; i++) {
                    notASwitch[entries[i].ev]?.(entries[i].data, false);
                }
                console.timeEnd("Parse log history");

                this.filterLines();
            });
        }
    }

    ngAfterViewInit() {
        const viewport = this.scrollbar.viewport.nativeElement;
        viewport.onscroll = (evt: WheelEvent) => {
            this.updateVirtualLines(viewport);

            if (evt.deltaY < 0) {
                this.scrollToBottom = false;
            }
            else {
                const currentBottom = viewport.scrollTop + viewport.clientHeight;
                this.scrollToBottom = currentBottom >= viewport.scrollHeight - 50;
            }
        };
    }

    ngOnDestroy() {
        this.socket?.disconnect();
    }

    filterLines() {
        let lines = this.lines;

        /**
         * Filter the lines.
         * This should be optimized where possible to minimize
         * update delays when we receive many log records
         * in a short period of time.
         *
         * Notably, we perform the easiest checks to reduce the
         * data set first, before performing the slower checks
         */

        if (this.showStdOut == false) {
            let ln = lines.length;
            let temp = [];

            for (let i = 0; i < ln; i++)
                if (lines[i].stream != "stdout")
                    temp.push(lines[i]);

            lines = temp;
        }

        if (this.showStdErr == false) {
            let ln = lines.length;
            let temp = [];

            for (let i = 0; i < ln; i++)
                if (lines[i].stream != "stderr")
                    temp.push(lines[i]);

            lines = temp;
        }

        if (this.showAgent == false) {
            let ln = lines.length;
            let temp = [];

            for (let i = 0; i < ln; i++)
                if (lines[i].stream != "agent")
                    temp.push(lines[i]);

            lines = temp;
        }

        if (this.query?.trim().length > 1) {
            let ln = lines.length;
            let temp = [];

            // Convert the string into a regex
            const wordRx = this.query
                .trim()
                .split(' ')
                .map(word => word
                    .split('')
                    // Transform all chars into their unicode values
                    .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
                    .join('')
                );

            const matchPaths: string[][] = [];
            const wordRxSource = wordRx.concat(wordRx);
            wordRx.forEach((rx, i) => {
                matchPaths.push(wordRxSource.slice(i, i + wordRx.length));
            });

            // Build a regex that arbitrarily matches order
            const rx = '(' +
                matchPaths
                    .map(words => words.join('.*'))
                    .join(")|(") +
                ')';

            const regex = new RegExp(rx, 'ui');

            for (let i = 0; i < ln; i++) {
                // If the line has a discrete msg property, check it.
                // Any other lines will implicitly be shown
                if (!lines[i].msg)
                    temp.push(lines[i]);
                else if (regex.test(lines[i].msg))
                    temp.push(lines[i]);
            }

            lines = temp;
        }

        this.filteredLines = lines;

        this.updateVirtualLines(this.scroller);
        if (this.scrollToBottom) {
            this.scroller.scrollTo({
                top: this.scroller.scrollHeight
            });
            setTimeout(() => {
                this.scroller.scrollTo({
                    top: this.scroller.scrollHeight
                });
            });
        }
    }

    updateVirtualLines(scroller: HTMLElement) {
        if (!scroller) return;
        const lines = this.filteredLines;

        const pos = this.scrollbar.viewport.scrollTop;
        // const bounds = scroller.getBoundingClientRect();
        const top = pos;
        const bottom = pos + this.scrollbar.viewport.clientHeight;

        const VIRTUAL_SCROLLING_OVERLAP = this.lineHeight * this.bufferLines;
        // Quickly recalculate the heights of the swimlanes
        let currentY = 0;
        const l = lines.length;

        for (let i = 0; i < l; i++) {
            const line = lines[i];

            // The swimlane is visible if it's within 500px of the top of the viewport,
            // or if it's within 500px of the bottom of the viewport.
            line.rendered =
                !(currentY + this.lineHeight + VIRTUAL_SCROLLING_OVERLAP < top) &&
                !(currentY - VIRTUAL_SCROLLING_OVERLAP > bottom);
            line.index = i;

            currentY += this.lineHeight;
        }

        const rendered = [];
        let ln = lines.length;
        for (let i = 0; i < ln; i++)
            if (lines[i].rendered)
                rendered.push(lines[i]);

        this.renderedLines = rendered;

        // console.log(this.renderedLines, this.filteredLines)

        this.changeDetector.detectChanges();
    }

    viewLineData(line: Line) {
        ViewJsonInMonacoDialog(this.dialog, line._original || line);
    }
}
