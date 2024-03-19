import { ScrollingModule } from '@angular/cdk/scrolling';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Fetch, MenuDirective } from '@dotglitch/ngx-common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { JobInstance } from 'types/agent-task';
import { PipelineDefinition, PipelineInstance } from 'types/pipeline';
import * as k8s from '@kubernetes/client-node';

@Component({
    selector: 'app-releases',
    templateUrl: './releases.component.html',
    styleUrls: ['./releases.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        NgScrollbarModule,
        MenuDirective,
        FormsModule,
        ScrollingModule
    ],
    standalone: true
})
export class ReleasesComponent implements OnInit {

    filter = '';
    pipelineInstances: PipelineInstance[] = [];
    pipelines: PipelineDefinition[] = [];
    kubeJobs: k8s.V1Job[] = [];
    jobs: JobInstance[] = [];

    selectedPipeline: PipelineDefinition;

    constructor(
        private readonly fetch: Fetch
    ) { }

    async ngOnInit() {
        const {
            pipelines,
            kubeJobs,
            jobs
        } = (await this.fetch.get<{
            pipelines: PipelineDefinition[],
            kubeJobs: k8s.V1Job[],
            jobs: JobInstance[];
        }>('/api/pipeline/?release=true'));

        this.pipelines = pipelines;
        this.kubeJobs = kubeJobs;
        this.jobs = jobs;

        this.selectPipeline(pipelines[0]);
    }

    selectPipeline(pipeline: PipelineDefinition) {
        this.selectedPipeline = pipeline;
        if (!pipeline) return;

        this.fetch.get(`/api/odata/pipeline_instance?$filter=spec.id eq '${pipeline.id}'`)
    }

    newPipeline() {
        this.fetch.post<PipelineDefinition>(`/api/odata/pipeline`, {
            label: 'My new Release',
            state: 'new',
            order: -1,
            group: "default",
            kind: "release"
        })
            .then(res => {
                location.hash = `#/Releases/${res.id}`;
            });
    }

    async triggerPipeline() {
        await this.fetch.get(`/api/pipeline/${this.selectedPipeline.id}/start`)
            .then(({ pipeline }) => {
                Object.assign(this.selectedPipeline, pipeline);
            });
    }
}
