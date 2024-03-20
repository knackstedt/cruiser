import { Component, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Fetch, FilemanagerComponent, MenuDirective, NGX_WEB_COMPONENTS_CONFIG, NgxFileManagerConfiguration, TooltipDirective } from '@dotglitch/ngx-common';
import { JobDefinition } from 'types/pipeline';
import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';
import { XtermWrapperComponent } from 'client/app/pages/stage-popup/job-details/xterm-wrapper/xterm-wrapper.component';
import { JobLogsComponent } from 'client/app/pages/stage-popup/job-details/job-logs/job-logs.component';

@Component({
    selector: 'app-job-details',
    templateUrl: './job-details.component.html',
    styleUrl: './job-details.component.scss',
    providers: [
        {
            provide: NGX_WEB_COMPONENTS_CONFIG,
            useValue: {
                assetPath: "assets/lib/icons"
            }
        }
    ],
    imports: [
        MatIconModule,
        MatTabsModule,
        MenuDirective,
        XtermWrapperComponent,
        JobLogsComponent,
        FilemanagerComponent,
        JobInstanceIconComponent
    ],
    standalone: true
})
export class JobDetailsComponent {

    public jobInstance;
    public job: JobDefinition;

    code = '';

    config: NgxFileManagerConfiguration;

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly data: any,
        private readonly fetch: Fetch
    ) {
        this.jobInstance = data.jobInstance
        this.job = data.job;
    }

    ngOnInit() {
        this.config = {
            apiSettings: {
                listEntriesUrl: `/api/pod/${this.jobInstance.id}/fs/`,
                uploadEntryUrlTemplate: filePath => `/api/pod/${this.jobInstance.id}/fs/upload?path=${filePath}`,
                downloadEntryUrlTemplate: filePath => `/api/pod/${this.jobInstance.id}/fs/download?path=${filePath}`,
                createDirectoryUrl: `/api/pod/${this.jobInstance.id}/fs/folder`,
                deleteEntryUrl: `/api/pod/${this.jobInstance.id}/fs/delete`,
                renameEntryUrl: `/api/pod/${this.jobInstance.id}/fs/rename`,
            },
            path: "/agent",
        }
    }
}
