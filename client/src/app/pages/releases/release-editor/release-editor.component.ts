import { ApplicationRef, ElementRef, Input, ViewChild, Injector, Component } from '@angular/core';
import { Fetch, MenuItem, ReactMagicWrapperComponent, VscodeComponent } from '@dotglitch/ngx-common';
import { ReactFlowComponent } from '../../../components/reactflow/reactflow-wrapper';
import { PipelineDefinition, SourceConfiguration, StageDefinition, Webhook } from 'src/types/pipeline';
import { ulid } from 'ulidx';
import { Edge, Handle, Node, Position } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { StageNodeComponent } from 'src/app/pages/releases/release-editor/reactflow-nodes/stage-node/stage-node.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import * as React from 'react';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StackEditorComponent } from 'ngx-stackedit';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { MatDialog } from '@angular/material/dialog';
import { StageEditorComponent } from './stage-editor/stage-editor.component';
import { ToastrService } from 'ngx-toastr';
import { UserService } from 'src/app/services/user.service';
import { VariablesSectionComponent } from 'src/app/components/variables-section/variables-section.component';
import { ImpossibleNodeComponent } from './reactflow-nodes/impossible-node/impossible-node.component';


@Component({
    selector: 'app-release-editor',
    standalone: true,
    imports: [
        ReactFlowComponent,
        MatSidenavModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatExpansionModule,
        MatCheckboxModule,
        MatTooltipModule,
        MatSelectModule,
        NgScrollbarModule,
        StackEditorComponent,
        VscodeComponent,
        VariablesSectionComponent,
        StageEditorComponent,
        FormsModule
    ],
    templateUrl: './release-editor.component.html',
    styleUrl: './release-editor.component.scss'
})
export class StagesComponent {
    @ViewChild("canvas") canvasRef: ElementRef<any>

    get container() { return this.canvasRef.nativeElement }

    // Incoming pipeline
    @Input() pipeline_id: string;
    @Input('new') isNewPipeline: any;

    /**
     * Cloned instance of the pipeline.
     */
    public pipeline: PipelineDefinition = {} as any;
    isUnsavedState = false;
    isRestoredSave = false;

    editingStage = false

    nodes: Node[] = [];
    edges: Edge[] = [];
    nodeTypes = {
        stage: ReactMagicWrapperComponent.WrapAngularComponent(
            StageNodeComponent,
            this.appRef,
            this.injector,
            {
                contextMenu: [
                    { label: "Edit Stage", action: s => this.editStage(s) },
                    { label: "Delete Stage", action: s => this.deleteStage(s) }
                ] as MenuItem<StageDefinition>[]
            },
            {
                onEditStage:         ({ stage }) => this.editStage(stage),

                onJobsClick:         ({ stage }) => (this.mode = "view") && (this.view = 'jobs')           && this.selectStage(stage),
                onNodeClick:         ({ stage }) => (this.mode = "view") && (this.view = 'stage')          && this.selectStage(stage),

                onTriggerClick:      ({ stage }) => (this.mode = "view") && (this.view = 'trigger')        && this.selectStage(stage),
                onTriggerEditClick:  ({ stage }) => (this.mode = "edit") && (this.view = 'trigger')        && this.selectStage(stage),

                onSourceClick:       ({ stage }) => (this.mode = "view") && (this.view = 'source')         && this.selectStage(stage),
                onSourceEditClick:   ({ stage }) => (this.mode = "edit") && (this.view = 'source')         && this.selectStage(stage),

                onScheduleClick:     ({ stage }) => (this.mode = "view") && (this.view = 'schedule')       && this.selectStage(stage),
                onScheduleEditClick: ({ stage }) => (this.mode = "edit") && (this.view = 'schedule')       && this.selectStage(stage),

                onManualRunClick:    ({ stage }) => (this.mode = "view") && (this.view = 'manual_trigger') && this.selectStage(stage),

                onApproverClick:     ({ stage }) => (this.mode = "view") && (this.view = 'approver')       && this.selectStage(stage),
                onApproverEditClick: ({ stage }) => (this.mode = "edit") && (this.view = 'approver')       && this.selectStage(stage),

                onWebhookEditClick:  ({ stage }) => (this.mode = "edit") && (this.view = 'webhook')        && this.selectStage(stage),
                onWebhookClick:      ({ stage }) => (this.mode = "view") && (this.view = 'webhook')        && this.selectStage(stage),

                onStageAddClick:     ({ stage }) => this.addStage({ stageTrigger: [stage.id] }),
                onStageCloneClick:   ({ stage }) => this.cloneStage(stage),
            },
            [
                React.createElement(Handle, { type: "target", position: Position.Left }),
                React.createElement(Handle, { type: "source", position: Position.Right })
            ]
        ),
        impossible: ReactMagicWrapperComponent.WrapAngularComponent(
            ImpossibleNodeComponent,
            this.appRef,
            this.injector,
            {
                // inputs
            },
            {
                // outputs
            },
            [
                React.createElement(Handle, { type: "source", position: Position.Right })
            ]
        )
    }

    mode: "edit" | "view" = "edit";
    view: string = "";
    selectedStage: StageDefinition;

    users = [];

    dataChangeEmitter = new Subject();
    dataChange$ = this.dataChangeEmitter.pipe(debounceTime(500));

    subscriptions = [
        // Save partial changes every 3s
        this.dataChange$.subscribe(() => this.patchPipeline())
    ]

    constructor(
        private readonly injector: Injector,
        private readonly appRef: ApplicationRef,
        public readonly fs: FileUploadService,
        private readonly dialog: MatDialog,
        private readonly fetch: Fetch,
        private readonly toaster: ToastrService,
        private readonly user: UserService
    ) {
        fetch.get<{value: any[]}>(`/api/odata/users`).then(data => {
            this.users = data.value;
        })
    }

    async ngAfterViewInit() {
        if (!this.pipeline.id) return;
        this.renderGraph();
    }

    async ngOnInit() {
        // If we have a pipeline id, load it and select it.
        if (typeof this.pipeline_id != "string") {
            return;
        }

        const url = `/api/odata/pipeline?$filter=_isUserEditInstance eq true and _sourceId eq '${this.pipeline_id}' and _userEditing eq '${this.user.value.login}'`;
        const previouslyEdited = await this.fetch.get<any>(url);

        if (previouslyEdited.value.length > 0) {
            this.initPipelineObject(previouslyEdited.value[0]);

            this.isUnsavedState = true;
            this.isRestoredSave = true;
        }
        else {
            const pipeline = await this.fetch.get<PipelineDefinition>(`/api/odata/${this.pipeline_id}`);
            const p = await this.fetch.put<PipelineDefinition>(`/api/odata/pipeline:${ulid()}`, {
                ...pipeline,
                _sourceId: this.pipeline_id,
                id: undefined,
                _isUserEditInstance: true,
                _userEditing: this.user.value.login
            });
            this.initPipelineObject(p);
        }

        if (this.pipeline.id) {
            this.renderGraph();
        }
    }


    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }


    private initPipelineObject(p: PipelineDefinition) {

        p.sources = p.sources ?? [];
        p.stages = p.stages ?? [];

        if (p.stages.length == 0) {
            p.stages.push({
                id: `pipeline_stage:${ulid()}`,
                label: "Stage 1",
                renderMode: "normal",
                order: 0,
                jobs: [
                    {
                        id: `pipeline_job:${ulid()}`,
                        taskGroups: [
                            {
                                id: `pipeline_task_group:${ulid()}`,
                                label: "Task Group 1",
                                order: 0,
                                tasks: []
                            }
                        ],
                        label: "Job 1",
                        order: 0
                    }
                ]
            });
        }

        this.pipeline = p;
    }

    // Save changes to the edit instance
    async patchPipeline() {
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    // Apply the changes of the cloned pipeline
    async save() {
        let data = {
            ...this.pipeline,
            id: this.pipeline['_sourceId'],
            _isUserEditInstance: undefined,
            _sourceId: undefined,
            "@odata.editLink": undefined,
            "@odata.id": undefined
        };

        if (data.state == "new")
            data.state = "paused";

        await this.fetch.put(`/api/odata/${this.pipeline['_sourceId']}`, data) as any;
        await this.fetch.delete(`/api/odata/${this.pipeline.id}`);

        location.href = "#/Releases";
    }

    // Perform a save of the current clone
    async saveClone() {
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, this.pipeline) as any;
    }

    async cancel() {
        // Delete the edit copy
        this.fetch.delete(`api/odata/${this.pipeline.id}`);

        // If we're editing the first draft of a pipeline and we choose to cancel
        // we need to delete the "original" that was created
        if (this.pipeline.state == "new")
            this.fetch.delete(`api/odata/${this.pipeline['_sourceId']}`);

        location.href = "#/Releases";
    }

    selectStage(stage: StageDefinition) {
        stage.stageTrigger = stage.stageTrigger ?? [];
        stage.webhooks = stage.webhooks ?? [];

        this.selectedStage = stage;
        this.renderGraph();

        console.log("selecting stage", stage, this.view)
    }

    async addStage(partial: Partial<StageDefinition> = {}) {
        this.pipeline.stages = this.pipeline.stages ?? [];
        const stage = {
            id: "pipeline_stage:" + ulid(),
            label: 'Stage - ' + (this.pipeline.stages.length + 1),
            order: this.pipeline.stages.length,
            jobs: [],
            ...partial
        } as any;

        this.pipeline.stages.push(stage);

        this.patchPipeline();
        this.renderGraph();
    }

    async cloneStage(stage: StageDefinition) {
        const newStage = structuredClone(stage);
        newStage.id = `pipeline_stage:${ulid()}`;
        newStage.label += " (clone)";

        this.pipeline.stages.push(newStage);

        this.patchPipeline();
        this.renderGraph();
    }

    filterPrecedingStages(stage: StageDefinition) {
        return this.pipeline.stages
            .filter(s => s.id != stage.id);
    }

    filterMissingPrecedingStages(stage: StageDefinition) {
        const stages = this.pipeline.stages;

        return stage.stageTrigger?.filter(st => !stages.find(s => s.id == st));
    }

    addWebhook(stage: StageDefinition) {
        stage.webhooks = stage.webhooks ?? [];
        stage.webhooks.push({
            id: `pipeline_stage_webhook:${ulid()}`,
            label: "Webhook",
            method: "GET",
            headers: []
        })
        this.patchPipeline();
    }

    deleteWebhook(stage: StageDefinition, webhook: Webhook) {
        stage.webhooks.splice(stage.webhooks.indexOf(webhook), 1);
        this.patchPipeline();
    }

    addSource(stage: StageDefinition) {
        stage.sources = stage.sources ?? [];
        stage.sources.push({
            id: `pipeline_source:${ulid()}`,
            label: "Source"
        });
        this.patchPipeline();
    }

    deleteSource(stage: StageDefinition, source: SourceConfiguration) {
        stage.sources.splice(stage.sources.indexOf(source), 1);
        this.patchPipeline();
    }

    editStage(stage: StageDefinition) {
        this.editingStage = true;
        this.selectedStage = stage;
    }

    async deleteStage(stage) {
        this.pipeline.stages = this.pipeline.stages.filter(s => s != stage);

        this.patchPipeline();
        this.renderGraph();
    }

    renderGraph() {
        if (!this.pipeline) return;
        let hasImpossibleNodes = false;

        const edges: Edge[] = [];
        const nodes: Node[] = this.pipeline.stages?.map(stage => {
            for (const precedingStageId of (stage.stageTrigger ?? [])) {
                // The taskGroup exists and can be mapped
                let isMissingPreReq = false;
                if (!this.pipeline.stages.find(tg => tg.id == precedingStageId)) {
                    hasImpossibleNodes = true;
                    isMissingPreReq = true;
                }

                const source = isMissingPreReq ? '_impossible' : precedingStageId.split(':')[1];
                const target = stage.id.split(':')[1];

                edges.push({
                    source: source,
                    target: target,
                    id: source + "_" + target,
                    sourceHandle: "source",
                    type: "bezier",
                    style: {
                        strokeWidth: 2,
                        stroke: '#00c7ff',
                    },
                    data: {
                        source: this.pipeline.stages.find(s => s.id == precedingStageId),
                        target: stage
                    }
                });
            }

            return {
                id: stage.id.split(':')[1],
                width:
                    stage?.renderMode == 'gateway'
                    ? 80
                    : stage?.renderMode == 'job_container'
                    ? 240
                    : 200,
                height: stage?.renderMode == 'job_container'
                    ? (stage.jobs.length * 90 + 40)
                    : 80,
                type: "stage",
                data: stage,
                targetPosition: null,
                sourcePosition: null,
                style: {
                    "--background": stage.id == this.selectedStage?.id
                        ? "#6d6d6d"
                        : "#4b4b4b",
                    "--background-hover": stage.id == this.selectedStage?.id
                        ? "#7f7f7f"
                        : "#595959",
                    "--border-color": stage.id == this.selectedStage?.id
                        ? "#00c7ff"
                        : "#0000"
                } as any, // react doesn't have typing for CSS variables.
                position: {
                    x: 0,
                    y: 0
                }
            }
        }) ?? [];

        if (hasImpossibleNodes) {
            nodes.push({
                id: "_impossible",
                width: 64,
                height: 64,
                type: "impossible",
                data: { },
                targetPosition: null,
                sourcePosition: null,
                position: {
                    x: 0,
                    y: 0
                }
            });
        }

        const dagreGraph = new dagre.graphlib.Graph();

        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'LR' });

        nodes.forEach(node => dagreGraph.setNode(node.id, { height: node.height, width: node.width + 50 }));
        edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target));

        dagre.layout(dagreGraph);

        nodes.forEach((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);

            const newX = nodeWithPosition.x - node.width / 2;
            const newY = nodeWithPosition.y - node.height / 2;

            // Offset the entire grid so we don't need to pan the view initially.
            node.position = {
                x: newX + 20,
                y: newY + 20,
            };
        });

        // console.log({ nodes, edges })

        this.edges = edges;
        this.nodes = nodes;
    }
}
