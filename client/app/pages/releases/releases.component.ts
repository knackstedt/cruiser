import { ScrollingModule } from '@angular/cdk/scrolling';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Fetch, MenuDirective, TooltipDirective } from '@dotglitch/ngx-common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { JobInstance } from 'types/agent-task';
import { PipelineDefinition, PipelineInstance, StageDefinition } from 'types/pipeline';
import * as k8s from '@kubernetes/client-node';
import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';
import { StagePopupComponent } from 'client/app/pages/stage-popup/stage-popup.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LiveSocketService } from 'client/app/services/live-socket.service';

@Component({
    selector: 'app-releases',
    templateUrl: './releases.component.html',
    styleUrls: ['./releases.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTooltipModule,
        MatProgressBarModule,
        NgScrollbarModule,
        MenuDirective,
        TooltipDirective,
        FormsModule,
        ScrollingModule,
        JobInstanceIconComponent,
        StagePopupComponent
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

    interval;
    dispose = false


    private subscriptions = [
        this.liveSocket.subscribe(({ ev, data }) => {
            this.getInstances();
        })
    ]

    constructor(
        private readonly fetch: Fetch,
        private readonly liveSocket: LiveSocketService
    ) {

    }

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

    ngOnDestroy() {
        this.dispose = true;
        clearInterval(this.interval);
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    selectPipeline(pipeline: PipelineDefinition) {
        this.selectedPipeline = pipeline;
        if (!pipeline) return;

        this.interval && clearTimeout(this.interval);
        this.getInstances();
    }

    async getInstances() {
        if (this.dispose) return;

        const { value: instances } = await this.fetch.get<{ value: PipelineInstance[]; }>(`/api/odata/pipeline_instance?$filter=spec.id eq '${this.selectedPipeline.id}'&$orderby=id desc&$fetch=status.jobInstances&$top=20`)
        this.parseInstances(instances);
    }

    parseInstances(instances: PipelineInstance[]) {
        instances.forEach(instance => {
            const jobInstanceList = (instance.status.jobInstances as any as JobInstance[]);

            instance.spec.stages?.forEach(stage => {
                const compositeState = {};
                const stateList = [];
                if (stage.jobs?.length == 0) {
                    const jobInstance = jobInstanceList?.find(j => j.stage == stage.id);
                    if (jobInstance) {
                        compositeState[jobInstance?.state] = 1;
                    }
                }
                else {
                    stage.jobs?.forEach(job => {
                        const jobInstance = jobInstanceList?.find(j => j.job == job.id);
                        if (!jobInstance) return;

                        job['_jobInstance'] = jobInstance;

                        compositeState[jobInstance.state] = compositeState[jobInstance.state] ?? 0;
                        compositeState[jobInstance.state]++;
                        stateList.push(jobInstance.state);
                    });
                }

                const approval = instance.status.stageApprovals
                    ?.find(sa => sa.stageId == stage.id);

                stage['_isReadyForApproval'] = approval?.readyForApproval;
                stage['_isApproved'] = approval?.approvalCount >= stage.requiredApprovals;

                const states = Object.keys(compositeState);
                stage['_state'] =
                    states.length == 0
                    ? 'pending'
                    : states.length == 1
                    ? states[0]
                    : states.includes("failed")
                    ? 'failed'
                    : states.includes("frozen")
                    ? 'frozen'
                    : 'building';
            });
        });
        this.pipelineInstances = instances;
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
                this.selectPipeline(this.selectedPipeline);
            });
    }

    async approveStage(instance: PipelineInstance, stage: StageDefinition) {
        await this.fetch.get(`/api/pipeline/${this.selectedPipeline.id}/${instance.id}/${stage.id}/approve`)
            .then(({ pipeline }) => {
                Object.assign(this.selectedPipeline, pipeline);
                this.selectPipeline(this.selectedPipeline);
            });
    }
}
