import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { interpolateRgbBasis } from 'd3';

@Component({
    selector: 'app-lazy-progress-distractor',
    templateUrl: './lazy-progress-distractor.component.html',
    styleUrls: ['./lazy-progress-distractor.component.scss'],
    imports: [MatProgressSpinnerModule],
    standalone: true
})
export class LazyProgressDistractorComponent {
    @Input() isDestroying = false;

    colors = [
        { hex: "", opacity: .5 },
    ]
    index = 0;
    current = []

    constructor() {
        const gradient = interpolateRgbBasis(
            // ["#ff0000", "#8994bb", "#00ff00", "#484d54"]
            ["#0d47a1", "#4a5477", "#ff9800", "#4f4f4f"]
        );

        this.colors = this.current = [
            gradient(0),
            gradient(1/8),
            gradient(2/8),
            gradient(3/8),
            gradient(4/8),
            gradient(5/8),
            gradient(6/8),
            gradient(7/8),
        ]
        .map(g => ({hex: g, opacity: .5}));


    }
    ngAfterViewInit() {
        // this.current = [...this.colors, ...this.colors].slice(this.index, this.index + 8);
    }
}
