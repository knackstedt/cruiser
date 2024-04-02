import { Component, OnInit } from '@angular/core';
import { DialogService, Fetch, MenuDirective, MenuItem, TooltipDirective } from '@dotglitch/ngx-common';
import { JobInstance } from 'types/agent-task';
import { PipelineDefinition, PipelineInstance, StageDefinition } from 'types/pipeline';
import * as k8s from '@kubernetes/client-node';
import { LiveSocketService } from 'client/app/services/live-socket.service';
import { ListViewComponent } from 'client/app/pages/releases/list-view/list-view.component';
import { GridViewComponent } from 'client/app/pages/releases/grid-view/grid-view.component';
import { MatIconModule } from '@angular/material/icon';
import { orderSort } from 'shared/order-sort';
import { UserService } from 'client/app/services/user.service';

@Component({
    selector: 'app-releases',
    templateUrl: './releases.component.html',
    styleUrls: ['./releases.component.scss'],
    imports: [
        MatIconModule,
        ListViewComponent,
        GridViewComponent
    ],
    standalone: true
})
export class ReleasesComponent implements OnInit {

    view = "list"

    filter = '';
    pipelineInstances: PipelineInstance[] = [];
    pipelines: PipelineDefinition[] = [];
    kubeJobs: k8s.V1Job[] = [];
    jobs: JobInstance[] = [];

    selectedPipeline: PipelineDefinition;
    pipelineGroups: { label: string, items: PipelineDefinition[]; }[] = [
        { label: "default", items: [] },
    ]

    interval;
    dispose = false

    readonly ctxMenu: MenuItem<PipelineDefinition>[] = [
        {
            label: "Edit",
            linkTemplate: pipeline => `#/Pipelines/${pipeline.id}`
        },
        {
            label: "Download JSON",
            action: async pipeline => {
                const link = document.createElement("a");
                link.download = pipeline.label.replace(/[^a-z0-9A-Z_\-$ ]/g, '') + '.json';
                link.href = `/api/pipeline/${pipeline.id}`;
                link.click();
                link.remove();
            }
        },
        {
            label: "Delete",
            action: async (pipeline) => {
                let res = await true;//this.dialog.confirmAction(`Are you sure you want to delete pipeline '${pipeline.label}'?`);
                if (!res) return;
            }
        },
        {
            label: "View History",
            linkTemplate: pipeline => `#/CommitGraph?pipeline=${pipeline.id}`
        },
        {
            label: "Compare",
            linkTemplate: pipeline => `#/Compare?pipeline=${pipeline.id}`
        },
        {
            label: "Changes",
            linkTemplate: pipeline => `#/Changes?pipeline=${pipeline.id}`
        },
        {
            label: "Deployment Map",
            linkTemplate: pipeline => `#/VSM?pipeline=${pipeline.id}`
        }
    ];

    private subscriptions = [
        this.liveSocket.subscribe(({ ev, data }) => {
            this.getInstances();
        })
    ]

    constructor(
        private readonly dialog: DialogService,
        private readonly fetch: Fetch,
        private readonly liveSocket: LiveSocketService,
        private readonly user: UserService
    ) {

    }

    async ngOnInit() {
        this.pipelineGroups = [
            { label: "default", items: [] },
        ];

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

        this.pipelineGroups.forEach(g => g.items.splice(0));

        this.pipelines?.forEach(pipeline => {
            const group = pipeline.group;

            let g = this.pipelineGroups.find(g => g.label == group);
            if (!g) {
                g = { label: group, items: [] };
                this.pipelineGroups.push(g);
            }

            g.items.push(pipeline);
        });

        this.pipelineGroups.forEach(g => g.items.sort(orderSort));

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

        const { value: instances } = await this.fetch.get<{ value: PipelineInstance[]; }>(
            `/api/odata/pipeline_instance` +
            `?$filter=spec.id eq '${this.selectedPipeline.id}'` +
            `&$orderby=id desc` +
            `&$fetch=status.jobInstances` +
            `&$top=20`
        )
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

    newPipeline(partial: Omit<Partial<PipelineDefinition>, 'id'> = {}) {
         this.fetch.post<PipelineDefinition>(`/api/odata/pipeline/`, {
            label: 'My new Pipeline',
            state: 'new',
            order: -1,
            group: 'default',
            stages: [],
            sources: [],
            ...partial
        })
            .then(res => {
                location.hash = `#/Releases/${res.id}`;
            });
    }

    editPipeline(triggeredPipeline = this.selectedPipeline) {

    }

    deletePipeline(pipeline = this.selectedPipeline) {
        this.fetch.delete(`/api/odata/${pipeline.id}`);

        // const el = (this.viewContainer.element.nativeElement as HTMLElement).querySelector(`[pipeline-id="${pipeline.id}"]`);
        // el.classList.add("destroy-animation");

        // setTimeout(() => {
        //     const group = this.pipelineGroups.find(g => g.label == pipeline.group);
        //     group.items.splice(group.items.findIndex(i => i.id == pipeline.id), 1);

        //     this.changeDetector.detectChanges();
        // }, 200);
    }

    async triggerPipeline(pipeline = this.selectedPipeline) {
        await this.fetch.get(`/api/pipeline/${pipeline.id}/start`)
            .then(({ pipeline: newPipeline }) => {
                Object.assign(pipeline, newPipeline);
                this.selectPipeline(pipeline);
            });
    }

    async triggerPipelineWithOptions(pipeline: PipelineDefinition) {
        await this.fetch.get(`/api/pipeline/${pipeline.id}/start`);
        pipeline.stats = pipeline.stats ?? { runCount: 0, successCount: 0, failCount: 0, totalRuntime: 0 };
        pipeline.stats.runCount += 1;
    }

    async approveStage(instance: PipelineInstance, stage: StageDefinition) {
        await this.fetch.get(`/api/pipeline/${this.selectedPipeline.id}/${instance.id}/${stage.id}/approve`)
            .then(({ pipeline }) => {
                Object.assign(this.selectedPipeline, pipeline);
                this.selectPipeline(this.selectedPipeline);
            });
    }

    viewHistory(pipeline: PipelineDefinition) {
        this.dialog.open('history', 'dynamic', {
            width: "90vw",
            height: "90vh",
            inputs: {
                pipeline
            }
        });
    }

    pausePipeline(pipeline: PipelineDefinition) {
    }

    resumePipeline(pipeline: PipelineDefinition) {
    }
}
