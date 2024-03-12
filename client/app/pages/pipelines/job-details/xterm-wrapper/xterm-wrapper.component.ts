import { Component, ElementRef, Input, OnInit, ViewChild, ViewEncapsulation, viewChild } from '@angular/core';

import { Terminal } from "xterm";
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import io, { Socket } from "socket.io-client";
import { AnsiToXTermTheme, darkTheme } from 'client/app/services/theme.service';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
    selector: 'app-xterm-wrapper',
    templateUrl: './xterm-wrapper.component.html',
    styleUrls: ['./xterm-wrapper.component.scss'],
    imports: [
        MatIconModule,
        MatProgressBarModule
    ],
    standalone: true,
    encapsulation: ViewEncapsulation.None
})
export class XtermWrapperComponent implements OnInit {
    @ViewChild("terminal") termElementRef: ElementRef;
    get terminalEl() { return this.termElementRef.nativeElement as HTMLElement }

    @Input() jobInstance;

    loadingState: 'connecting' |
    "pty_died" | "disconnected" |
    "connected" | "launching_pty" |
    "ready" = 'connecting';

    showTerminal = false;

    rowHeight = 17;
    charWidth = 8;

    socket: Socket;

    terminal: Terminal;
    fitAddon: FitAddon;
    webglAddon: WebglAddon;

    resizeObserver: ResizeObserver;

    constructor(
        private readonly dialogRef: MatDialogRef<any>
    ) { }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.resizeObserver = new ResizeObserver(() => this.onResize);
        this.resizeObserver.observe(this.terminalEl);
        this.loadingState = 'connecting';

        const socket = this.socket = io({
            path: "/ws/socket-tunnel",
            withCredentials: true
        });

        socket.on("connect", () => {
            this.loadingState = 'connected';
            socket.emit("$connect", { job: this.jobInstance.job });
        });

        socket.on("disconnect", () => {
            this.loadingState = 'disconnected';
        });

        socket.on("$connected", () => {
            this.loadingState = 'launching_pty';

            socket.emit("ssh:launch", {
                // shell: this.config.shell,
                // cwd: this.cwd || this.config.homedir
            });
        });

        socket.on("ssh:fatal", ex => {
            console.log("Pty failed to init", ex);
        });

        // The pty on the remote died
        socket.on("ssh:exit", code => {
            this.loadingState = 'pty_died';

            // If exit code is zero, the user submitted "ctrl+d" to close.
            // We'll thus close the dialog, assuming the user is done.
            console.log("Pty was killed", code);

            if (code == 0) {
                this.dialogRef.close();
            }
        });

        socket.on("ssh:reconnect", id => {
            this.loadingState = 'launching_pty';

            this.webglAddon.dispose();
            this.terminal?.dispose();

            socket.emit("ssh:launch", {
                // shell: this.config.shell,
                // cwd: this.cwd || this.config.homedir
            });
        });

        socket.on("ssh:started", ({ id }) => {
            this.loadingState = 'ready';

            // this.terminal?.dispose();

            // this.loadFont("ubuntumono");

            // Create an xterm.js instance.
            const terminal = this.terminal = new Terminal();
            // const fitAddon = this.fitAddon = new FitAddon();

            // terminal.loadAddon(fitAddon);

            // terminal.loadAddon(new WebLinksAddon());
            // const unicode11Addon = new Unicode11Addon();
            // terminal.loadAddon(unicode11Addon);
            // terminal.unicode.activeVersion = '11';


            // this.webglAddon.onContextLoss(e => {
            //     // e.preventDefault();
            //     this.webglAddon.dispose();
            //     this.webglAddon = null;
            // });

            terminal.options.theme = AnsiToXTermTheme(darkTheme);
            terminal.options.fontFamily = "Ubuntu Mono";
            terminal.options.fontSize = this.rowHeight; // height in px
            terminal.options.fontWeight = "100";
            terminal.options.fontWeightBold = "900";
            // terminal.options.lineHeight;
            // terminal.options.letterSpacing;


            // Attach created terminal to a DOM element.
            terminal.open(this.terminalEl);
            terminal.loadAddon(this.webglAddon = new WebglAddon());

            terminal.onData(data => this.socket.emit("ssh:input", { input: data, id: id }));

            this.showTerminal = true;
            this.onResize();
        });

        socket.on("ssh:output", data => this.terminal?.write(data));
    }

    ngOnDestroy() {
        this.webglAddon?.dispose();
        this.terminal?.dispose();
        this.socket?.close();
        this.resizeObserver.disconnect();

        this.webglAddon = null;
        this.terminal = null;
        this.socket = null;
        this.resizeObserver = null;
        this.showTerminal = false;
    }

    onResize() {
        const rect = this.terminalEl.getBoundingClientRect();

        const rows = Math.floor(rect.height / this.rowHeight);
        const cols = Math.floor(rect.width / this.charWidth);

        this.terminal?.resize(cols, rows);
        this.socket?.emit("ssh:resize", {
            rows,
            cols
        })
    }
}
