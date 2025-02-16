import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PipelineJobDefinition, PipelineDefinition, PipelineInstance, PipelineStage } from 'src/types/pipeline';
import { TableModule } from 'primeng/table';
import { MatDialog } from '@angular/material/dialog';
import { JobDetailsComponent } from './job-details/job-details.component';
import { Fetch } from '@dotglitch/ngx-common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobInstanceIconComponent } from 'src/app/components/job-instance-icon/job-instance-icon.component';
import { DurationViewerComponent } from 'src/app/components/duration-viewer/duration-viewer.component';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { JobInstance } from '../../../../../server/src/types/agent-task';
import { LiveSocketService } from 'src/app/services/live-socket.service';

@Component({
    selector: 'app-stage-popup',
    templateUrl: './stage-popup.component.html',
    styleUrl: './stage-popup.component.scss',
    imports: [
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        MatInputModule,
        FormsModule,
        TableModule,
        JobInstanceIconComponent,
        DurationViewerComponent
    ],
    standalone: true,
    host: {
        '[style.--color]': "stage['_latestJob']?.state == 'failed' ? 'red' : 'blue'"
    }
})
export class StagePopupComponent {
    @Input() pipelineInstance: PipelineInstance;
    @Input() stage: PipelineStage;

    // runningJobs: JobDefinition[] = [];
    jobs: (PipelineJobDefinition & {
        _instance: JobInstance
    })[] = [];

    runningJobs = 0;
    successfulJobs = 0;
    failedJobs = 0;

    private _subscriptions = [
        this.liveSocket.subscribe(s => {
            const instance = s.data.result;
            if (s.ev != "job_instance" || s.data.action != "UPDATE") {
                const job = this.jobs.find(j => j.id == instance.job);
                if (!job) {
                    return;
                    debugger;
                }
                // Update the instance (replace)
                job._instance = instance;
                this.updateStats();
            }
        })
    ]

    constructor(
        private readonly dialog: MatDialog,
        private readonly fetch: Fetch,
        private readonly liveSocket: LiveSocketService
    ) {

    }

    async ngOnInit() {
        const url = `/api/odata/job_instance?$filter=stage eq '${this.stage.id}' and pipeline_instance eq '${this.pipelineInstance.id}'`;
        const runningJobs = (await this.fetch.get(url))['value'];

        const stageJobMap = {};
        const runningJobMap = {};

        runningJobs.forEach(j => runningJobMap[j.id] = j);
        this.stage.jobs.forEach(j => stageJobMap[j.id] = j);

        runningJobs.forEach(rj => {
            const job = stageJobMap[rj.job];
            if (job) {
                job._instance = rj;
            }
        });
        // Combine the running jobs and the "defined" jobs
        // this.allJobs = runningJobs.concat(this.stage.jobs.filter(j => !runningJobMap[j.id]));
        this.jobs = this.stage.jobs as any;
        this.updateStats();
    }

    ngOnDestroy() {
        this._subscriptions?.forEach(s => s.unsubscribe());
    }

    updateStats() {
        this.runningJobs = this.jobs.filter(j => !["finished", "failed"].includes(j._instance.state)).length;
        this.successfulJobs = this.jobs.filter(j => j._instance.state == "finished").length;
        this.failedJobs = this.jobs.filter(j => j._instance.state == "failed").length
    }

    onPipelineRestart() {

    }

    onViewLogs(job: PipelineJobDefinition) {
        this.dialog.open(JobDetailsComponent, {
            data: {
                job,
                jobInstance: job['_instance']
            }
        })
    }

    getProgressDuration(selfEpoch: number, nextEpoch: number) {
        return (nextEpoch ?? Date.now()) / selfEpoch * 100;
    }
}
