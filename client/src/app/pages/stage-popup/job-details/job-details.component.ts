import { Component, Inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { io, Socket } from 'socket.io-client';
import { Fetch, FilemanagerComponent, MenuDirective, NGX_WEB_COMPONENTS_CONFIG, NgxFileManagerConfiguration, TooltipDirective } from '@dotglitch/ngx-common';
import { JobDefinition, TaskDefinition } from 'src/types/pipeline';
import { JobInstanceIconComponent } from 'src/app/components/job-instance-icon/job-instance-icon.component';
import { XtermWrapperComponent } from 'src/app/pages/stage-popup/job-details/xterm-wrapper/xterm-wrapper.component';
import { JobLogsComponent } from 'src/app/pages/stage-popup/job-details/job-logs/job-logs.component';
import { PipelineSocketService } from 'src/app/services/pipeline-socket.service';
import { JobInstance } from 'src/types/agent-task';
import { BindSocketLogger } from 'src/app/utils/utils';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

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
        MatButtonModule,
        MatTooltipModule,
        MenuDirective,
        XtermWrapperComponent,
        JobLogsComponent,
        FilemanagerComponent,
        JobInstanceIconComponent
    ],
    standalone: true
})
export class JobDetailsComponent {

    readonly completeStates = ['finished', 'failed', 'cancelled'];

    public jobInstance: JobInstance;
    public job: JobDefinition;

    config: NgxFileManagerConfiguration;
    connected = false;
    socket: Socket;
    breakpoints: any[] = [];
    selectedIndex = 0;
    loadTerminal = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly data: any,
        private readonly fetch: Fetch,
        private readonly pipelineSocket: PipelineSocketService
    ) {
        // this.jobInstance = data.jobInstance
        this.job = data.job;
    }

    ngOnInit() {
        if (!this.jobInstance) {
            this.fetch.get(`/api/odata/${this.data.jobInstance.id}`)
                .then(ji => {
                    this.jobInstance = ji as any;
                    this.ngOnInit();
                });
            return;
        }

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

        if (!['finished', 'failed', 'cancelled'].includes(this.jobInstance.state)) {
            const socket = this.socket = io({
                path: "/ws/socket-tunnel",
                withCredentials: true
            });
            BindSocketLogger("breakpoint", socket);

            socket.on("connect", () => {
                socket.emit("$connect", { jobInstanceId: this.jobInstance.id });
            });
            socket.on("$connected", () => {
                this.connected = true;
                // Tell the socket to give us a list of any active breakpoints.
                socket.emit("breakpoint:get-list");
            });
            socket.on("disconnect", () => {
                this.connected = false;
            });

            socket.on("breakpoint:list", ({breakpoints}) => {
                this.breakpoints = breakpoints;
            });
        }
    }

    clearBreakpoint(breakpoint, retry) {
        this.socket.emit("breakpoint:resume", {
            ...breakpoint,
            retry
        })
    }

    killJob() {
        console.log("killer")
        this.pipelineSocket.emit("$stop-job", { jobInstanceId: this.jobInstance.id })
    }
}
