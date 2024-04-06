import { Component, Inject, Input, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Fetch } from '@dotglitch/ngx-common';
import { JobInstanceIconComponent } from 'src/app/components/job-instance-icon/job-instance-icon.component';
import { TableModule } from 'primeng/table';
import { JobInstance } from 'src/types/agent-task';
import { PipelineDefinition, StageDefinition } from 'src/types/pipeline';

@Component({
    selector: 'app-pipeline-history',
    templateUrl: './pipeline-history.component.html',
    styleUrls: ['./pipeline-history.component.scss'],
    imports: [
        TableModule,
        JobInstanceIconComponent,
        MatIconModule,
        MatTooltipModule
    ],
    standalone: true
})
export class PipelineHistoryComponent {
    @Input() pipeline: PipelineDefinition;

    jobs: (JobInstance & {
        _stage: StageDefinition
    })[] = [];

    constructor(
        private readonly fetch: Fetch
    ) {

    }

    async ngOnInit() {
        const stageMap = {};
        this.pipeline.stages?.forEach(s => {
            stageMap[s.id] = s;
        })

        const jobs = (await this.fetch.get(`/api/odata/job_instance?$filter=pipeline eq '${this.pipeline.id}'`))['value'];

        jobs.forEach(job => {
            const stage = stageMap[job.stage];
            if (stage) {
                job._stage = stage
            }
            else {
                job._stage = {
                    name: "Removed stage"
                }
            }
        });
    }
}
