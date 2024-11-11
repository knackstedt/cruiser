import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, NgZone, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective } from '@dotglitch/ngx-common';
import { NgScrollbar, NgScrollbarModule } from 'ngx-scrollbar';
import { JobLogsComponent, RenderedItem } from '../job-logs.component';
import { ViewJsonInMonacoDialog } from 'src/app/utils/utils';
import { MatTabsModule } from '@angular/material/tabs';


@Component({
    selector: 'app-logs-renderer',
    standalone: true,
    templateUrl: './logs-renderer.component.html',
    styleUrl: './logs-renderer.component.scss',
    imports: [
        NgTemplateOutlet,
        NgScrollbarModule,
        TooltipDirective,
        MatIconModule,
        MatTabsModule
    ]
})
export class LogsRendererComponent {
    @ViewChild(NgScrollbar) scrollbar: NgScrollbar;
    get scroller() { return this.scrollbar?.viewport.nativeElement; }
    @ViewChild("fontDetector") fontDetector: ElementRef;

    // Width of the scroll viewport. Required to make horizontal scrolling not clip
    scrollWidth = 1000;
    charWidth = 20;
    scrollToBottom = true;

    readonly lineHeight = 19;
    readonly bufferLines = 3;

    @Input() showTimestamps = true;

    private _lines: RenderedItem[] = [];
    @Input() set lines(val: RenderedItem[]) {
        this._lines = val;
        this.updateVirtualLines();
        this.calculateScrollWidth();
        this.refocusPanel(false);
    };
    get lines() { return this._lines }
    renderedItems: RenderedItem[] = [];

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
        private readonly ngZone: NgZone,
        private readonly dialog: MatDialog,
        public readonly jobLogs: JobLogsComponent
    ) {
    }

    ngOnInit() {
        // this.lines = [];
        this.renderedItems = [];
        console.log("init", this)
    }

    ngAfterViewInit(delay = false) {
        this.ngZone.runOutsideAngular(() => {
            const viewport = this.scroller;
            viewport.onscroll = (evt: WheelEvent) => {
                this.ngZone.run(() => {
                    this.updateVirtualLines();

                    if (evt.deltaY < 0) {
                        this.scrollToBottom = false;
                    }
                    else {
                        const currentBottom = viewport.scrollTop + viewport.clientHeight;
                        this.scrollToBottom = currentBottom >= viewport.scrollHeight - 50;
                    }
                })
            };
        })

        this.onResize();
    }

    updateVirtualLines() {
        if (!this.scroller) return;

        const lines = this.lines;

        const top    = this.scrollbar.viewport.scrollTop;
        // !!! clientHeight !!!
        const bottom = top + this.scrollbar.viewport.contentHeight;

        const VIRTUAL_SCROLLING_OVERLAP = this.lineHeight * this.bufferLines;

        let currentY = 0;
        const l = lines.length;
        let index = 0;
        for (let i = 0; i < l; i++) {
            const line = lines[i];
            const lineHeightFactor = line.kind == "line" ? 1 : 2;

            line._visible =
                !(currentY + (this.lineHeight * lineHeightFactor) + VIRTUAL_SCROLLING_OVERLAP < top) &&
                !(currentY - VIRTUAL_SCROLLING_OVERLAP > bottom);

            line._index = index;
            index += lineHeightFactor;

            currentY += this.lineHeight * lineHeightFactor;
        }

        const rendered = [];
        let ln = lines.length;
        for (let i = 0; i < ln; i++)
            if (lines[i]._visible)
                rendered.push(lines[i]);

        this.renderedItems = rendered;

        this.changeDetector.detectChanges();
    }

    refocusPanel(delay = true) {
        setTimeout(() => {
            this.updateVirtualLines();
            if (this.scrollToBottom) {
                this.goToEnd();
            }
        }, delay ? 15 : 0);
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

    @HostListener("window:resize")
    onResize() {
        const el: HTMLDivElement = this.fontDetector.nativeElement;
        const mWidth = el.children[0].clientWidth;
        const dotWidth = el.children[1].clientWidth;

        if (mWidth != dotWidth) {
            console.error(new Error("Cannot initiate with a non monospace font"));
        }
        this.charWidth = mWidth/el.children[0].textContent.length;
        this.calculateScrollWidth();
    }

    calculateScrollWidth() {
        let charCount = 0;
        this.lines.forEach(l => {
            if (l.plaintext.length > charCount)
                charCount = l.plaintext.length;
        });

        // The timestamp consumes ~14 characters
        charCount += 14;

        this.scrollWidth = this.charWidth * charCount;
    }

    viewLineData(line: RenderedItem) {
        ViewJsonInMonacoDialog(this.dialog, line.record);
    }

    onTaskGroupSelection(line: RenderedItem) {
        line.taskGroups.forEach(tg => {
            this.jobLogs.visibleTaskGroups[tg.tgid].visible = false;
        })
        this.jobLogs.visibleTaskGroups[line.taskGroups[line.selectedTabIndex].tgid].visible = true;
        this.jobLogs.filterLines();
    }
}
