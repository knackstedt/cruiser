import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { JobDefinition, PipelineDefinition, StageDefinition } from 'types/pipeline';
import { TableModule } from 'primeng/table';
import { MatDialog } from '@angular/material/dialog';
import { JobDetailsComponent } from '../job-details/job-details.component';
import { Fetch } from '@dotglitch/ngx-common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';

@Component({
    selector: 'app-stage-popup',
    templateUrl: './stage-popup.component.html',
    styleUrl: './stage-popup.component.scss',
    imports: [
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        TableModule,
        JobInstanceIconComponent
    ],
    standalone: true,
    host: {
        '[style.--color]': "stage['_latestJob']?.state == 'failed' ? 'red' : 'blue'"
    }
})
export class StagePopupComponent {
    @Input() pipeline: PipelineDefinition;
    @Input() stage: StageDefinition;

    runningJobs: JobDefinition[] = [];
    allJobs: JobDefinition[] = [];

    constructor(
        private readonly dialog: MatDialog,
        private readonly fetch: Fetch
    ) {

    }

    async ngOnInit() {
        const runningJobs = (await this.fetch.get(`/api/odata/jobs?$filter=stage eq '${this.stage.id}'`))['value'];

        const stageJobMap = {};
        const runningJobMap = {};

        runningJobs.forEach(j => runningJobMap[j.id] = j);
        this.stage.jobs.forEach(j => stageJobMap[j.id] = j);

        runningJobs.forEach(rj => {
            const job = stageJobMap[rj.job];
            if (job) {
                job['_runningJob'] = rj;
            }
        });

        // Combine the running jobs and the "defined" jobs
        // this.allJobs = runningJobs.concat(this.stage.jobs.filter(j => !runningJobMap[j.id]));
        this.stage.jobs = [...this.stage.jobs];
    }

    onPipelineRestart() {

    }

    onViewLogs(job: JobDefinition) {
        this.dialog.open(JobDetailsComponent, {
            data: {
                job,
                jobInstance: job['_runningJob']
            }
        })
    }

    getProgressDuration(selfEpoch: number, nextEpoch: number) {
        return (nextEpoch ?? Date.now()) / selfEpoch * 100;
    }

    printDuration(epoch: number) {
        const duration = (Date.now() - epoch);

        const date = new Date(Date.UTC(0, 0, 0, 0, 0, 0, duration));

        const days    = date.getUTCDay();
        const hours   = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        if (days > 0) return days + 'd' + hours + 'h' + minutes + 'm';
        if (hours > 0) return hours + 'h' + minutes + 'm' + seconds + 's';
        if (minutes > 0) return minutes + 'm' + seconds + 's';
        if (seconds > 0) return seconds + 's';

        return '⏳';
    }
}
