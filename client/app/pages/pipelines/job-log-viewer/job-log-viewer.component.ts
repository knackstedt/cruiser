import { CdkScrollableModule, ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Fetch } from '@dotglitch/ngx-common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { JobDefinition } from 'types/pipeline';
import Convert from 'ansi-to-html';

@Component({
    selector: 'app-job-log-viewer',
    templateUrl: './job-log-viewer.component.html',
    styleUrl: './job-log-viewer.component.scss',
    imports: [
        NgScrollbarModule,
        ScrollingModule,
        DatePipe,
        NgTemplateOutlet
    ],
    standalone: true,
})
export class JobLogViewerComponent {

    readonly lineHeight = 19;

    lines: any[];

    convert = new Convert({

    });

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly job: JobDefinition,
        private readonly fetch: Fetch
    ) {

    }

    async ngOnInit() {
        // TODO: this double fires because of the tooltip wrapper.
        if (!this.job) return;



    }
}
