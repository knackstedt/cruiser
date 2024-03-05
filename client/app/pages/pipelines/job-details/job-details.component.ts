import { Component, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Fetch, MenuDirective, TooltipDirective } from '@dotglitch/ngx-common';
import { JobDefinition } from 'types/pipeline';
import { XtermWrapperComponent } from 'client/app/pages/pipelines/job-details/xterm-wrapper/xterm-wrapper.component';
import { JobLogsComponent } from 'client/app/pages/pipelines/job-details/job-logs/job-logs.component';

@Component({
    selector: 'app-job-details',
    templateUrl: './job-details.component.html',
    styleUrl: './job-details.component.scss',
    imports: [
        MatIconModule,
        MatTabsModule,
        MenuDirective,
        XtermWrapperComponent,
        JobLogsComponent
    ],
    standalone: true
})
export class JobDetailsComponent {

    public jobInstance;
    public job: JobDefinition;

    code = '';

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly data: any,
        private readonly fetch: Fetch
    ) {
        this.jobInstance = data.jobInstance
        this.job = data.job;
    }

}
