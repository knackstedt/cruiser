import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';

@Component({
    selector: 'app-duration-viewer',
    template: '',
    styles: `:host { display: inline }`,
    standalone: true
})
export class DurationViewerComponent {
    @Input() startEpoch: number;
    @Input() endEpoch: number;

    private interval;

    constructor(private readonly elementRef: ElementRef) { }

    ngAfterViewInit() {
        const el = this.elementRef.nativeElement as HTMLElement;
        this.interval = setInterval(() => {
            if (this.endEpoch > 0) {
                // If the job is complete or is completed, disable the interval.
                this.ngOnDestroy();
                el.innerText = this.printDuration(this.startEpoch, this.endEpoch);
            }
            else {
                el.innerText = this.printDuration(this.startEpoch);
            }
        }, 100);
    }

    ngOnDestroy() {
        clearInterval(this.interval);
    }

    printDuration(startEpoch: number, endEpoch = Date.now()) {
        if (!startEpoch)
            return '⏳';
        // debugger;
        const duration = (endEpoch - startEpoch);

        const date = new Date(Date.UTC(0, 0, 0, 0, 0, 0, duration));

        const days = date.getUTCDay();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        if (days > 0) return days + 'd' + hours + 'h' + minutes + 'm';
        if (hours > 0) return hours + 'h' + minutes + 'm' + seconds + 's';
        if (minutes > 0) return minutes + 'm' + seconds + 's';
        if (seconds > 0) return seconds + 's';

        return '⏳';
    }
}
