import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, ViewChild, NgZone, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';

import { Fetch, TooltipDirective } from '@dotglitch/ngx-common';
import { NgScrollbar, NgScrollbarModule } from 'ngx-scrollbar';
import { io, Socket } from 'socket.io-client';
import ansi, { ParsedSpan, parse } from 'ansicolor';
import { gitmojis } from 'gitmojis';

import { darkTheme } from 'src/app/services/theme.service';
import { JobInstance } from 'src/types/agent-task';
import { BindSocketLogger, ViewJsonInMonacoDialog } from 'src/app/utils/utils';
import { LogMessage, LogRecord } from 'src/types/agent-log';
import { MaterialSymbols } from 'src/app/utils/mat-symbols';
import { TaskGroupDefinition } from 'src/types/pipeline';
import { LogsRendererComponent } from "./logs-renderer/logs-renderer.component";

export type RenderedItem = {
    kind: "line" | "block"
    level: "error" | "info" | "warn" | "fatal" | "debug" | "stdout" | "stderr"
    timestamp: string;
    record: LogRecord

    selectedTabIndex?: number
    // output rendered into HTML elements (kind: line)
    html?: ParsedSpan[],

    // The task groups and their line data (kind: block)
    taskGroups?: {
        label: string,
        tgid: string
        parent: RenderedItem
    }[],

    plaintext: string,

    // If this line is part of a block && if it's expanded
    _expanded: boolean,

    // If the line should be rendered in the viewport
    _visible: boolean

    // TODO: Remove this
    _index: number,
};

@Component({
    selector: 'app-job-logs',
    templateUrl: './job-logs.component.html',
    styleUrls: ['./job-logs.component.scss'],
    imports: [
        TooltipDirective,
        MatIconModule,
        MatCheckboxModule,
        MatInputModule,
        LogsRendererComponent
    ],
    standalone: true
})
export class JobLogsComponent {
    @Input() jobInstance: JobInstance;
    @ViewChild(LogsRendererComponent) logsRenderer: LogsRendererComponent;

    showStdOut = true;
    showStdErr = true;
    showAgent = true;
    showTimestamps = true;
    query = '';

    connected = false;
    isCompletedRun = false;

    lines: RenderedItem[] = [];
    filteredLines: RenderedItem[] = [];

    lineBlocks: RenderedItem[] = [];
    lineBlockMap: { [key: string]: RenderedItem } = {};

    visibleTaskGroups: {[key: string]: { visible: boolean }} = {};

    private socket: Socket;

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
        this.lines = [];
        this.filteredLines = [];
        this.lineBlocks = [];
        this.lineBlockMap = {};
        this.visibleTaskGroups = {};

        // console.log(this);

        // If the pipeline is no longer running, attempt to load the logs from
        // the disk
        if (['finished', 'failed', 'cancelled'].includes(this.jobInstance.state)) {
            this.isCompletedRun = true;
            const url = [
                '/api/blobstore/log',
                this.jobInstance.pipeline,
                this.jobInstance.pipeline_instance,
                this.jobInstance.stage,
                this.jobInstance.job,
                this.jobInstance.id
            ].join('/') + '.log';

            const data = await this.fetch.get<string>(url, { responseType: "text" });


            this.filterLines();
        }
        else {
            const socket = this.socket = io({
                path: "/socket/socket-tunnel",
                withCredentials: true
            });
            BindSocketLogger('logs', socket);
            let historyFetchTime: number;

            socket.on("connect", () => {
                this.lines = [];
                socket.emit("$connect", { jobInstanceId: this.jobInstance.id });

                this.changeDetector.detectChanges();
            });
            socket.on("$connected", () => {
                this.connected = true;
                historyFetchTime = Date.now();
                console.log("we fuckin connect")
                socket.emit("$log:get-history", { jobInstanceId: this.jobInstance.id });
            });
            socket.on("disconnect", () => {
                this.connected = false;
            });

            socket.on("log:stdout", (data) => this.onReceiveLine(data));
            socket.on("log:stderr", (data) => this.onReceiveLine(data));
            socket.on("log:agent", (data) => this.onReceiveLine(data));

            socket.on("log:history", (entries: LogRecord[]) => {
                console.log("Fetched history in " + (Date.now() - historyFetchTime) + "ms")
                console.log(entries)
                console.time("Parse log history");
                entries.forEach(e => this.onReceiveLine(e, false));

                console.timeEnd("Parse log history");
                // console.log(this.lines);

                this.filterLines();
            });
        }
    }

    ngOnDestroy() {
        this.socket?.disconnect();
    }

    onReceiveLine(line: LogRecord, runHooks = true) {
        const iso = (new Date(line.time)).toISOString();

        const lines = line.msg ? [line.msg] : line.chunk;
        const parseMatches = (matches: RegExpMatchArray[]) => {
            const se = matches.map(m => ({
                start: m.index,
                end: m.index + m[1].length
            }));
            se.sort((a, b) => a.start - b.start);

            return se;
        };

        // If this property is set, this line is actually the start or end of a parallel block
        // of executing tasks
        if (line.properties?.['parallelBlock'] == true && line.properties['taskGroups']?.length > 0) {
            // debugger;
            const gid = line.properties?.['gid'];
            // TODO: This should be slimmed down somehow.
            const taskGroups = line.properties['taskGroups'] as TaskGroupDefinition[];
            taskGroups.forEach((tg, i) => {
                this.visibleTaskGroups[tg.id] = {
                    visible: i == 0
                }
            })
            const lineBlock: RenderedItem = {
                kind: "block",
                _expanded: true,
                _index: 0,
                _visible: true,
                selectedTabIndex: 0,
                taskGroups: taskGroups.map(tg => ({ label: tg.label, parent: null, tgid: tg.id })),
                level: "info",
                plaintext: "",
                record: line,
                timestamp: null
            };


            lineBlock.taskGroups.forEach(tg => tg.parent = lineBlock);
            this.lineBlocks.push(lineBlock);
            this.lineBlockMap[gid] = lineBlock;
            this.lines.push(lineBlock);
            return;
        }

        lines.forEach((ln, i) => {
            // If the first line is empty don't print it.
            if (i == 0 && !ln.trim()) return;
            // TODO: Should plaintext strip ANSI codes?

            // If this is an agent log, perform some mutations that wouldn't normally occur.
            const item = (() => {
                if (!["stdout", "stderr"].includes(line.level)) {
                    const codeRanges = parseMatches([...ln.matchAll(/(`[^`]+?`)/g)]);
                    let html: ParsedSpan[] = [];

                    if (codeRanges.length == 0) {
                        html.push({
                            css: "",
                            text: ln
                        });
                    }
                    else {
                        let range = codeRanges.shift();
                        let index = 0;
                        do {
                            html.push({
                                css: "",
                                text: ln.slice(index, range.start)
                            });
                            html.push({
                                css: "",
                                class: "code",
                                text: ln.slice(range.start, range.end)
                            } as any);

                            // Update tracking variables
                            index = range.end;
                            range = codeRanges.shift();
                        } while(range)

                        // Add the last item
                        html.push({
                            css: "",
                            text: ln.slice(index)
                        });

                        // Purge any empty spans
                        html = html.filter(s => s.text.length > 0);
                    }

                    return {
                        kind: "line",
                        _index: 0,
                        _expanded: true,
                        _visible: false,
                        level: line.level,
                        timestamp: iso.replace(/^[^T]+T/, ''),
                        html,
                        plaintext: ln,
                        record: line
                    };
                }
                else {
                    const html = parse(ln).spans.map(s => {
                        s.text = this.parseGitmoji(s.text);
                        return s;
                    });
                    return {
                        kind: "line",
                        _index: 0,
                        _expanded: true,
                        _visible: false,
                        level: line.level,
                        timestamp: iso.replace(/^[^T]+T/, ''),
                        html,
                        plaintext: ln,
                        record: line
                    };
                }
            })();

            // If the line is grouped, find it's group and add it
            // const gid = line.properties?.['gid'];
            // const tgid = line.properties?.['tgid'];

            // // Now find the task group within the block
            // const block = this.lineBlockMap[gid]?.taskGroups.find(e => e.tgid == tgid);
            // if (gid && block) {
            //     // debugger;
            //     block.lines.push(item as RenderedItem);
            // }
            // else {
                // debugger;
                this.lines.push(item as RenderedItem);
            // }
        });

        // console.log(this.lines);
        if (runHooks) {
            this.filterLines();
            this.logsRenderer.updateVirtualLines();
        }
    }

    filterLines() {
        let lines = this.lines;

        lines = lines.filter(l => {
            const tgid = l.record.properties?.['tgid'];
            return !tgid || this.visibleTaskGroups[tgid].visible;
        });

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
                if (lines[i].level != "stdout")
                    temp.push(lines[i]);

            lines = temp;
        }

        if (this.showStdErr == false) {
            let ln = lines.length;
            let temp = [];

            for (let i = 0; i < ln; i++)
                if (lines[i].level != "stderr")
                    temp.push(lines[i]);

            lines = temp;
        }

        if (this.showAgent == false) {
            let ln = lines.length;
            let temp = [];

            // Blocks should not be excluded when show agent is false.
            for (let i = 0; i < ln; i++)
                if (["stdout", "stderr"].includes(lines[i].level) || lines[i].kind == "block")
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
                const line = lines[i];
                // If the line has a discrete msg property, check it.
                // Any other lines will implicitly be shown
                if (!line.plaintext) {
                    temp.push(line);
                }
                else if (regex.test(line.plaintext))
                    temp.push(line);
            }

            lines = temp;
        }

        this.filteredLines = lines;
    }

    downloadLog() {
        const log = this.lines.map(l => {
            return [
                l.timestamp,
                '|',
                ['stderr', 'stdout'].includes(l.level) ? ('[' + l.level + ']') : '[agent]',
                l.plaintext
            ].join(' ');

        }).join('\n')
        const blob = new Blob([log], {
            type: 'text/plain'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // TODO: add the job label
        a.download = `${this.jobInstance.id}.log`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        a.remove();
    }

    parseGitmoji(text: string) {
        // TODO: inject mat-icons
        // TODO: Inject well-known gitmoji to mat-icons?
        return text?.replace(/:([a-z0-9_\-]{3,30}):/i, (match, id: string) => {
            id = id.toLowerCase();
            // Logic to preform as few array scans as possible to find the match.
            let matSymbolIndex = MaterialSymbols.indexOf(id);
            matSymbolIndex = matSymbolIndex == -1
                ? MaterialSymbols.indexOf(id.replace(/_/g, '-'))
                : matSymbolIndex;

            if (matSymbolIndex > -1) {
                return `<span class="mat-icon material-icons">${MaterialSymbols[matSymbolIndex]}</span>`;
            }
            // TODO: Register icon paths that are well-known (and or allow users to upload custom icons)

            // By this point if we don't have a mat symbol we can try matching a gitmoji...
            return gitmojis.find(g => g.code == id)?.emoji || id;
        });
    }

    refocusPanel(delay?) {
        this.logsRenderer.refocusPanel(delay)
    }
}
