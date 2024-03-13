import { Component, Input } from '@angular/core';
import { Fetch } from '@dotglitch/ngx-common';
import { PipelineDefinition } from 'types/pipeline';
import { ulid } from 'ulidx';

@Component({
    selector: 'app-stages',
    standalone: true,
    imports: [

    ],
    templateUrl: './stages.component.html',
    styleUrl: './stages.component.scss'
})
export class StagesComponent {
    @Input() pipeline: PipelineDefinition;

    constructor(
        private readonly fetch: Fetch
    ) {

    }

    async addStage() {
        const stage = {
            id: "pipeline_stage:" + ulid(),
            label: 'Stage - ' + (this.pipeline.stages.length + 1),
            order: this.pipeline.stages.length,
            jobs: []
        } as any;

        this.pipeline.stages.push(stage);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    editStage(stage) {
        console.log("edit da fuckin stage yobbie");
        // this.selectedStage = stage;
        // this.tabIndex = 1;
    }

    async deleteStage(stage) {
        this.pipeline.stages = this.pipeline.stages.filter(s => s != stage);
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }
}
