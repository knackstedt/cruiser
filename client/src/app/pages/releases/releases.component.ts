import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { DialogService, Fetch, MenuDirective, MenuItem, TooltipDirective } from '@dotglitch/ngx-common';
import { JobInstance } from 'src/types/agent-task';
import { PipelineDefinition, PipelineInstance, StageDefinition } from 'src/types/pipeline';
import * as k8s from '@kubernetes/client-node';
import { LiveSocketService } from 'src/app/services/live-socket.service';
import { ListViewComponent } from 'src/app/pages/releases/list-view/list-view.component';
import { GridViewComponent } from 'src/app/pages/releases/grid-view/grid-view.component';
import { MatIconModule } from '@angular/material/icon';
import { orderSort } from 'src/shared/order-sort';
import { UserService } from 'src/app/services/user.service';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-releases',
    templateUrl: './releases.component.html',
    styleUrls: ['./releases.component.scss'],
    imports: [
        MatIconModule,
        MatButtonModule,
        ListViewComponent,
        GridViewComponent
    ],
    standalone: true
})
export class ReleasesComponent implements OnInit {

    @ViewChild(ListViewComponent) listView: ListViewComponent;
    @ViewChild(GridViewComponent) gridView: GridViewComponent;

    view = "list"
    filter = '';

    _pipelineInstances: PipelineInstance[] = [];
    pipelineInstances: PipelineInstance[] = [];
    pipelines: PipelineDefinition[] = [];
    filteredPipelines: PipelineDefinition[] = [];
    kubeJobs: k8s.V1Job[] = [];
    // jobs: JobInstance[] = [];

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
                const blob = new Blob([JSON.stringify(pipeline)], { type: "application/json" });

                const link = document.createElement("a");
                link.download = pipeline.label.replace(/[^a-z0-9A-Z_\-$ ]/g, '') + '.json';
                link.href = URL.createObjectURL(blob);
                link.dataset['downloadurl'] = ["application/json", link.download, link.href].join(":");
                const evt = new MouseEvent("click", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                });

                link.dispatchEvent(evt);
                link.remove();
            }
        },
        {
            label: "Delete",
            action: (pipeline) => {
                this.confirmationService.confirm({
                    header: `Are you sure you want to delete pipeline '${pipeline.label}'?`,
                    accept: () => {
                        this.fetch.delete(`/api/odata/${pipeline.id}`).then(res => {
                            // TODO: delete the one pipeline.
                            this.ngOnInit();
                        });
                    }
                });
            }
        }
    ];

    readonly instanceCtxMenu: MenuItem<{ pipeline: PipelineDefinition, instance: PipelineInstance}>[] = [
        {
            labelTemplate: data => "Instance " + data.instance.identifier
        },
        {
            label: "Cancel",
            // isVisible: ({ pipeline, instance }) => ['started', 'running', 'waiting'].includes(instance.status.phase),
            action: ({pipeline, instance}) => {
                this.fetch.post(`/api/pipeline/${pipeline.id}/${instance.id}/stop`, {})
                    .then(res => {
                        // ???
                    })
                    .catch(err => this.toastr.warning("Failed to cancel pipeline"))
            }
        },
    ];

    private subscriptions = [
        this.liveSocket.subscribe(({ ev, data }) => {
            switch(data.action) {
                case "CREATE": {
                    switch (ev) {
                        case "pipeline":          { this.pipelines.unshift(data.result); break }
                        case "pipeline_instance": { this._pipelineInstances.unshift(data.result); break }
                        case "job_instance":      {
                            const job = data.result as JobInstance;
                            const instance = this._pipelineInstances.find(i => i.id == job.pipeline_instance);

                            // This pipeline isn't visible, so we'll do nothing
                            if (!instance) {
                                return;
                            }

                            const instanceList = (instance.status.jobInstances = instance.status.jobInstances ?? []) as any as JobInstance[];
                            instanceList.unshift(job);
                            break;
                        }
                    }
                    break;
                }
                case "UPDATE": {
                    switch (ev) {
                        case "pipeline": {
                            this.pipelines.splice(
                                this.pipelines.findIndex(p => p.id == data.result.id),
                                1,
                                data.result
                            );
                            break;
                        }
                        case "pipeline_instance": {
                            // this._pipelineInstances = [data.result];
                            // this._pipelineInstances[this._pipelineInstances.findIndex(p => p.id == data.result.id)] = data.result
                            this._pipelineInstances.splice(
                                this._pipelineInstances.findIndex(p => p.id == data.result.id),
                                1,
                                data.result
                            );
                            // const old = this._pipelineInstances.findIndex(p => p.id == data.result.id);
                            // Object.assign(old, data.result);
                            break;
                        }
                        case "job_instance": {
                            // console.log("replacing job",
                            //     this.jobs.splice(
                            //         this.jobs.findIndex(p => p.id == data.result.id),
                            //         1,
                            //         data.result
                            //     ),
                            //     data.result
                            // )
                            // console.log(this.jobs, data.result);
                            // Object.assign(this.jobs.find(p => p.id == data.result.id), data.result);
                            const job = data.result as JobInstance;
                            const instance = this._pipelineInstances.find(i => i.id == job.pipeline_instance);

                            // This pipeline isn't visible, so we'll do nothing
                            if (!instance) {
                                return;
                            }
                            const instanceList = instance.status?.jobInstances as any as JobInstance[];
                            const index = instanceList.findIndex(ji => ji.id == job.id);
                            instanceList[index] = job;

                            break;
                        }
                    }
                    break;
                }
                case "DELETE": {
                    switch (ev) {
                        case "pipeline": {
                            (this.pipelines.find(p => p.id == data.result.id) ?? {} as any).deleted = true;
                            break;
                        }
                        case "pipeline_instance": { /* invalid? */ break; }
                        case "job_instance": { /* invalid? */ break; }
                    }
                    break;
                }
            }

            // debugger;
            // this.ngOnInit();
            this.parseData();
            this.parseInstances(this._pipelineInstances);
            this.changeDetector.detectChanges()
        })
    ]

    constructor(
        private readonly dialog: DialogService,
        private readonly fetch: Fetch,
        private readonly liveSocket: LiveSocketService,
        private readonly user: UserService,
        private readonly changeDetector: ChangeDetectorRef,
        private readonly confirmationService: ConfirmationService,
        private readonly toastr: ToastrService
    ) {

    }

    async ngOnInit() {
        const pipelines = await this.fetch.get<PipelineDefinition[]>('/api/pipeline/?release=true');

        this.pipelines = this.filteredPipelines = pipelines;

        this.parseData();

        this.selectPipeline(this.selectedPipeline ?? pipelines[0]);
    }

    ngOnDestroy() {
        this.dispose = true;
        clearInterval(this.interval);
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    parseData() {
        this.pipelineGroups = [
            { label: "default", items: [] },
        ];
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
        this.pipelines = [...(this.pipelines ?? [])];
        this.kubeJobs = [...this.kubeJobs];
    }

    selectPipeline(pipeline: PipelineDefinition) {
        this.selectedPipeline = pipeline;
        if (!pipeline) return;

        this.interval && clearTimeout(this.interval);
        this.getInstances();
    }

    async getInstances() {
        if (this.dispose) return;

        if (this.selectedPipeline) {
            const { value: instances } = await this.fetch.get<{ value: PipelineInstance[]; }>(
                `/api/odata/pipeline_instance` +
                `?$filter=spec.id eq '${this.selectedPipeline.id}'` +
                `&$orderby=id desc` +
                `&$fetch=status.jobInstances` +
                `&$top=20`
            );
            this._pipelineInstances = instances;
            this.parseInstances(instances);
        }
    }

    parseInstances(instances: PipelineInstance[]) {
        instances.forEach(instance => {
            if (!instance.status) debugger;
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
        this.pipelineInstances = [...instances];
        this.listView.changeDetector.markForCheck();
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
                // this.selectPipeline(pipeline);
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
                // this.selectPipeline(this.selectedPipeline);
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

    filterPipelines() {
        // Convert the string into a regex
        const wordRx = this.filter
            .trim()
            .split(' ')
            .map(word => word
                .split('')
                // Transform text into unicode escape sequences
                .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
                .join('')
            );

        const matchPaths: string[][] = [];
        const wordRxSource = wordRx.concat(wordRx);
        // Create a merged regex containing all words in any order/combination
        wordRx.forEach((rx, i) => {
            matchPaths.push(wordRxSource.slice(i, i + wordRx.length));
        });

        // Build a regex that arbitrarily matches order
        const rx = new RegExp('(' +
            matchPaths
                .map(words => words.join('.*'))
                .join(")|(") +
            ')'
        );


        this.filteredPipelines = this.pipelines
            .filter(p => rx.test(p.label));
    }
}
