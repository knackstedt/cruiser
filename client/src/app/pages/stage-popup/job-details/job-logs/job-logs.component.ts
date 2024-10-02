import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, ViewChild, NgZone, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import stripAnsi from 'strip-ansi';
import ansiRegex from 'ansi-regex';

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
import { Breakpoint } from '../job-details.component';
import { LiveSocketService } from 'src/app/services/live-socket.service';

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

const modes: {[key: string]: string} = {
    0: 'clear_all',
    1: 'set:font:bold',
    22: 'rm:font:bold',
    2: 'set:font:dim',
    // 22: 'rm:font:dim',
    3: 'set:font:italic',
    23: 'rm:font:italic',
    4: 'set:font:underline',
    24: 'rm:font:underline',
    5: 'set:font:blink',
    25: 'rm:font:blink',
    7: 'set:font:inverse',
    27: 'rm:font:inverse',
    8: 'set:font:invisible',
    28: 'rm:font:invisible',
    9: 'set:font:strikethrough',
    29: 'rm:font:strikethrough',

    30: "set:colorfg:black",
    40: "set:colorbg:black",
    31: "set:colorfg:red",
    41: "set:colorbg:red",
    32: "set:colorfg:green",
    42: "set:colorbg:green",
    33: "set:colorfg:yellow",
    43: "set:colorbg:yellow",
    34: "set:colorfg:blue",
    44: "set:colorbg:blue",
    35: "set:colorfg:magenta",
    45: "set:colorbg:magenta",
    36: "set:colorfg:cyan",
    46: "set:colorbg:cyan",
    37: "set:colorfg:white",
    47: "set:colorbg:white",
    // if 5 is the following digit, 256 color mode
    // if 2 if the following digit, RGB mode
    38: "set:colorfg:RGB",
    48: "set:colorbg:RGB",
    39: "set:colorfg:default",
    49: "set:colorbg:default",

    90: "set:colorfg:bright-black",
    100: "set:colorbg:bright-black",
    91: "set:colorfg:bright-red",
    101: "set:colorbg:bright-red",
    92: "set:colorfg:bright-green",
    102: "set:colorbg:bright-green",
    93: "set:colorfg:bright-yellow",
    103: "set:colorbg:bright-yellow",
    94: "set:colorfg:bright-blue",
    104: "set:colorbg:bright-blue",
    95: "set:colorfg:bright-magenta",
    105: "set:colorbg:bright-magenta",
    96: "set:colorfg:bright-cyan",
    106: "set:colorbg:bright-cyan",
    97: "set:colorfg:bright-white",
    107: "set:colorbg:bright-white",
    99: "set:colorfg:bright-default",
    109: "set:colorbg:bright-default",
}
// Reverse the keys and values of modes above.
const modesInverse: {[key: string]: string} = {};
Object.entries(modes).forEach(([k,v]) => modesInverse[v] = k);

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

    breakpoints: Breakpoint[] = [];

    private socket: Socket;

    private _subscriptions = [
        this.liveSocket.subscribe(mutation => {
            // Ignore changes to things that are irrelevant
            const updated = mutation.data?.result as JobInstance;
            if (!updated || mutation.ev != "job_instance" || updated.id != this.jobInstance?.id)
                return;

            // If we're watching it while it completes, we need to switch over to the full
            // log as provided by the server.
            if (updated.state != this.jobInstance.state && updated.state == "failed") {
                this.jobInstance = updated;
                this.initDatasource();
            }
        })
    ]

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
        private readonly fetch: Fetch,
        private readonly dialog: MatDialog,
        private readonly liveSocket: LiveSocketService
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

        this.initDatasource();
    }

    ngOnDestroy() {
        this.socket?.disconnect();
        this._subscriptions?.forEach(s => s.unsubscribe());
    }

    async initDatasource() {
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
            console.time("Parse log history");
            const lines = data.split('\n');

            const l = lines.length;
            for (let i = 0; i < l; i++) {
                const ln = lines[i];

                if (ln[0] == "{") {
                    this.onReceiveLine(JSON.parse(ln));
                }
                else {
                    this.onReceiveLine({
                        level: "stderr",
                        time: i,
                        msg: ln,
                    })
                }
            }

            console.timeEnd("Parse log history");
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
                console.log("we fuckin connect");
                socket.emit("$log:get-history", { jobInstanceId: this.jobInstance.id });
            });
            socket.on("disconnect", () => {
                this.connected = false;
            });

            socket.on("log:stdout", (data) => this.onReceiveLine(data));
            socket.on("log:stderr", (data) => this.onReceiveLine(data));
            socket.on("log:agent", (data) => this.onReceiveLine(data));

            socket.on("log:history", (entries: LogRecord[]) => {
                console.log("Fetched history in " + (Date.now() - historyFetchTime) + "ms");
                // console.log(entries);
                console.time("Parse log history");
                entries.forEach(e => this.onReceiveLine(e, false));
                console.timeEnd("Parse log history");

                this.filterLines();
            });


            socket.on("breakpoint:list", ({ breakpoints }) => {
                this.breakpoints = breakpoints;
            });
        }
    }

    private defaults = {
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        blink: false,
        inverse: false,
        invisible: false,
        strikethrough: false,

        colorfg: "default",
        colorbg: "default"
    };

    private ansi = {...this.defaults};

    onReceiveLine(line: LogRecord, runHooks = true) {
        const iso = (new Date(line.time)).toISOString();

        const lines = typeof line.msg == "string" ? [line.msg] : line.chunk;
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


            // Written with help from https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797
            let lastAnsiStyles = '';
            if (line.level[0] == 's') {
                Object.entries(this.defaults).forEach(([k,v]) => {
                    // If the current stored value doesn't match,
                    // we need to apply the style ANSI sequence
                    if (this.ansi[k] !== v) {
                        // Find the numeric code.
                        if (typeof this.ansi[k] == "boolean") {
                            const numCode = modesInverse[(this.ansi[k] ? "set:" : "rm:") + "font:" + k];
                            lastAnsiStyles += '\x1b[' + numCode + 'm';
                        }
                        // If it's RGB we need to attach the value itself
                        else if (typeof this.ansi[k] == "string" && this.ansi[k].includes(';')) {
                            lastAnsiStyles += '\x1b[' + this.ansi[k] + 'm';
                        }
                        else {
                            const numCode = modesInverse["set:" + k + ':' + this.ansi[k]];
                            lastAnsiStyles += '\x1b[' + numCode + 'm';
                        }
                    }
                });
                // console.log("lastANSIStyles", lastAnsiStyles);

                // Read through the string and identify all of the escape sequences.
                // We'll track these and merge them onto the rest of the output from the process so that
                // we can render the log output correctly AND in realtime as the stream is written.
                const length = ln.length;
                for (let k = 0; k < length; k++) {
                    const c = ln[k];
                    // If the character isn't the initiation of an escape sequence,
                    // ignore it and continue
                    if (c.charCodeAt(0) != 0x1b) continue;

                    let chars = []; // we do not need 0x1b here.

                    for (let j = k; j < length && k < length; j++, k++) {
                        const c = ln[j];
                        const code = c.charCodeAt(0);
                        if (code == 0x4d || code == 0x6d) {
                            break;
                        }
                        // We don't want to track 1b and the square bracket
                        else if (code != 0x1b && code != 0x5b) {
                            chars.push(c);
                            // we hit an 'm' or 'M' so terminate the detection process.
                        }
                    }

                    const expression = chars.join('');
                    const [mode, ...additional] = expression.split(';');

                    const modeData = modes[mode];
                    if (!modeData) {
                        // If we don't have a known mode data for it, we won't do anything.
                        // console.warn("Unknown ANSI sequence was detected. Will not be tracked for further log output rendering", { mode, additional });
                        continue;
                    }
                    // This is a special action that wipes ALL styling properties.
                    if (modeData == "clear_all") {
                        this.ansi = {...this.defaults};
                        continue;
                    }

                    const [setOrRm, property, name] = modeData.split(':');

                    // Specifically this number clears BOTH bold AND dim
                    if (chars[0] == 0x16) {
                        this.ansi.bold = false;
                        this.ansi.dim = false;
                        continue;
                    }
                    // If this is a font property just update the mode
                    if (property == "font") {
                        this.ansi[name] = setOrRm == "set";
                        continue;
                    }
                    // If this is a color property we'll need to be more cautious
                    else {
                        if (name == "RGB") {
                            this.ansi[property] = mode + ';' + additional.join(';');
                        }
                        else {
                            this.ansi[property] = name;
                        }
                        continue;
                    }
                }
                // console.log({ ...this.ansi, ln })
            }

            // If this is an agent log, perform some mutations that wouldn't normally occur.
            const item = (() => {
                // Agent records are processed here.
                if (line.level[0] != 's') {
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

                    const html = parse(lastAnsiStyles + ln).spans.map(s => {
                        s.text = this.parseGitmoji(s.text);

                        // Strip out any leftover ANSI markers.
                        s.text = stripAnsi(s.text);
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

            this.lines.push(item as RenderedItem);
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

    clearBreakpoint(breakpoint: Breakpoint, action: number) {
        this.socket.emit("breakpoint:resume", {
            ...breakpoint,
            action
        });
    }
}
