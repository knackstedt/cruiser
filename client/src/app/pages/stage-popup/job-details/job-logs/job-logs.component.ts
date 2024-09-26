import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, ViewChild, NgZone } from '@angular/core';
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

type RenderedLine = ({
    level: "error" | "info" | "warn" | "fatal" | "debug" | "stdout" | "stderr"
    timestamp: string;
    record: LogRecord


    // output rendered into HTML elements
    html: ParsedSpan[],
    plaintext: string,

    // If this line is part of a block && if it's expanded
    _expanded: boolean,

    // If the line should be rendered in the viewport
    _visible: boolean
    _top: number,

    // TODO: Remove this
    _index: number,
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
    // changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobLogsComponent {
    @ViewChild("fontDetector") fontDetector: ElementRef;
    @ViewChild(NgScrollbar) scrollbar: NgScrollbar;
    get scroller() { return this.scrollbar.viewport.nativeElement; }
    @Input() jobInstance: JobInstance;


    readonly lineHeight = 19;
    readonly bufferLines = 10;

    // Width of the scroll viewport. Required to make horizontal scrolling not clip
    scrollWidth = 1000;
    charWidth = 20;

    showStdOut = true;
    showStdErr = true;
    showAgent = true;
    showTimestamps = true;
    query = '';

    connected = false;
    isCompletedRun = false;

    lines: RenderedLine[] = [];
    filteredLines: RenderedLine[] = [];
    renderedLines: RenderedLine[] = [];

    scrollToBottom = true;

    private socket: Socket;

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
        private readonly fetch: Fetch,
        private readonly dialog: MatDialog,
        private readonly ngZone: NgZone
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
        this.renderedLines = [];

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

    ngAfterViewInit(delay = false) {

        const viewport = this.scroller;
        viewport.onscroll = (evt: WheelEvent) => {
            this.updateVirtualLines();

            if (evt.deltaY < 0) {
                this.scrollToBottom = false;
            }
            else {
                const currentBottom = viewport.scrollTop + viewport.clientHeight;
                this.scrollToBottom = currentBottom >= viewport.scrollHeight - 50;
            }
        };

        this.onResize();
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

        lines.forEach((ln, i) => {
            // If the first line is empty don't print it.
            if (i == 0 && !ln.trim()) return;
            // TODO: Should plaintext strip ANSI codes?

            // If this is an agent log, perform some mutations that wouldn't normally occur.
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

                this.lines.push({
                    _index: 0,
                    _top: 0,
                    _expanded: true,
                    _visible: false,
                    level: line.level,
                    timestamp: iso.replace(/^[^T]+T/, ''),
                    html,
                    plaintext: ln,
                    record: line
                });
            }
            else {
                const html = parse(ln).spans.map(s => {
                    s.text = this.parseGitmoji(s.text);
                    return s;
                });
                this.lines.push({
                    _index: 0,
                    _top: 0,
                    _expanded: true,
                    _visible: false,
                    level: line.level,
                    timestamp: iso.replace(/^[^T]+T/, ''),
                    html,
                    plaintext: ln,
                    record: line
                });
            }
        });

        // console.log(this.lines);
        if (runHooks) {
            this.filterLines();
        }
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

            for (let i = 0; i < ln; i++)
                if (["stdout", "stderr"].includes(lines[i].level))
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

        lines.forEach((line, index) => {
            line._index = index;
            line._top = index * this.lineHeight;
        })
        this.filteredLines = lines;

        this.refocusPanel(false);

        this.calculateScrollWidth();
    }

    updateVirtualLines() {
        const scroller = this.scroller;
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
            line._visible =
                !(currentY + this.lineHeight + VIRTUAL_SCROLLING_OVERLAP < top) &&
                !(currentY - VIRTUAL_SCROLLING_OVERLAP > bottom);
            line._index = i;

            currentY += this.lineHeight;
        }

        const rendered = [];
        let ln = lines.length;
        for (let i = 0; i < ln; i++)
            if (lines[i]._visible)
                rendered.push(lines[i]);

        this.renderedLines = rendered;

        // console.log(this.renderedLines, this.filteredLines)

        this.changeDetector.detectChanges();
    }

    refocusPanel(delay = true) {
        setTimeout(() => {
            this.updateVirtualLines();
            if (this.scrollToBottom) {
                this.goToEnd()
            }
        }, delay ? 15 : 0)
    }

    goToEnd() {
        this.scroller.scrollTo({
            top: this.scroller.scrollHeight
        });

        setTimeout(() => {
            this.scroller.scrollTo({
                top: this.scroller.scrollHeight
            });
        });
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

    viewLineData(line: RenderedLine) {
        ViewJsonInMonacoDialog(this.dialog, line.record);
    }

    @HostListener("window:resize")
    onResize() {
        const el: HTMLDivElement = this.fontDetector.nativeElement;
        const mWidth = el.children[0].clientWidth;
        const dotWidth = el.children[1].clientWidth;

        if (mWidth != dotWidth) {
            console.error(new Error("Cannot initiate with a non monospace font"));
        }
        this.charWidth = mWidth;
        this.calculateScrollWidth();
    }

    calculateScrollWidth() {
        let charCount = 0;
        this.filteredLines.forEach(l => {
            if (l.plaintext.length > charCount)
                charCount = l.plaintext.length;
        });

        // The timestamp consumes ~14 characters
        charCount += 14;

        this.scrollWidth = this.charWidth * charCount;
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
}
