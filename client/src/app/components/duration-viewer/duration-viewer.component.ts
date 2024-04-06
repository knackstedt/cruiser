import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';

@Component({
    selector: 'app-duration-viewer',
    template: '',
    styles: `:host { display: inline }`,
    standalone: true
})
export class DurationViewerComponent {
    @Input() epoch: number;

    private interval;

    constructor(private readonly elementRef: ElementRef) { }

    ngAfterViewInit() {
        const el = this.elementRef.nativeElement as HTMLElement;
        this.interval = setInterval(() => {
            el.innerText = this.printDuration(this.epoch);
        }, 100);
    }

    ngOnDestroy() {
        clearInterval(this.interval);
    }

    printDuration(epoch: number) {
        const duration = (Date.now() - epoch);

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
