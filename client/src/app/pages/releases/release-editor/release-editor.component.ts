import { ApplicationRef, Component, ElementRef, Injector, Input, NgZone, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import dagre from '@dagrejs/dagre';
import { Fetch, MenuDirective, MenuItem, VscodeComponent } from '@dotglitch/ngx-common';
import { Edge, MarkerType, Node } from '@xyflow/react';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { StackEditorComponent } from 'ngx-stackedit';
import { ToastrService } from 'ngx-toastr';
import { XYFlowModule } from 'ngx-xyflow';
import { Subject, debounceTime } from 'rxjs';
import { VariablesSectionComponent } from 'src/app/components/variables-section/variables-section.component';
import { SourceNodeComponent } from 'src/app/pages/releases/release-editor/reactflow-nodes/source-node/source-node.component';
import { StageNodeComponent } from 'src/app/pages/releases/release-editor/reactflow-nodes/stage-node/stage-node.component';
import { WebhookNodeComponent } from 'src/app/pages/releases/release-editor/reactflow-nodes/webhook-node/webhook-node.component';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { UserService } from 'src/app/services/user.service';
import { PipelineDefinition, PipelineSource, PipelineStage, Webhook } from 'src/types/pipeline';
import { ulid } from 'ulidx';
import { ImpossibleNodeComponent } from './reactflow-nodes/impossible-node/impossible-node.component';
import { StageEditorComponent } from './stage-editor/stage-editor.component';

@Component({
    selector: 'app-release-editor',
    standalone: true,
    imports: [
        XYFlowModule,
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
        MenuDirective,
        StageEditorComponent,
        StageNodeComponent,
        ImpossibleNodeComponent,
        SourceNodeComponent,
        WebhookNodeComponent,
        FormsModule
    ],
    templateUrl: './release-editor.component.html',
    styleUrl: './release-editor.component.scss'
})
export class ReleaseEditorComponent {
    @ViewChild("canvas") canvasRef: ElementRef<any>;
    // @ViewChild(ReactFlowComponent) reactFlow: ReactFlowComponent;

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

    readonly stageNodeCtxMenu: MenuItem<PipelineStage>[] = [
        { label: 'Edit Stage', action: s => this.editStage(s) },
        { label: 'Disable Stage', action: s => this.disableStage(s), isVisible: s => !s.disabled },
        { label: 'Enable Stage', action: s => this.enableStage(s), isVisible: s => s.disabled },
        { label: 'Delete Stage', action: s => this.deleteStage(s) }
    ];

    readonly sourceCtxMenu: MenuItem<{ stage: PipelineStage, source: PipelineSource; }>[] = [
        {
            label: "Edit Source",
            action: ({ stage, source }) => {
                this.ngZone.run(() => {
                    this.mode = "edit";
                    this.selectedStage = stage;
                    this.selectedSource = source;
                    this.renderGraph();
                    this.view = 'source';
                });
            }
        },
        {
            label: "Enable Source",
            isVisible: ({ source }) => source.disabled,
            action: ({ stage, source }) => {
                this.ngZone.run(() => {
                    source.disabled = false;
                    this.renderGraph();
                });
            }
        },
        {
            label: "Disable Source",
            isVisible: ({ source }) => !source.disabled,
            action: ({ stage, source }) => {
                this.ngZone.run(() => {
                    source.disabled = true;
                    this.renderGraph();
                });
            }
        },
        {
            label: "Delete Source",
            action: ({ stage, source }) => {
                this.ngZone.run(() => {
                    stage.sources.splice(stage.sources.indexOf(source), 1);
                    this.dataChangeEmitter.next(0);
                    this.renderGraph();
                    this.selectStage(stage);
                });
            }
        }
    ];

    readonly webhookCtxMenu: MenuItem<{ stage: PipelineStage, webhook: Webhook; }>[] = [
        {
            label: "Edit Webhook",
            action: ({ stage, webhook }) => {
                this.ngZone.run(() => {
                    this.mode = "edit";
                    this.selectedStage = stage;
                    this.selectedWebhook = webhook;
                    this.renderGraph();
                    this.view = 'webhook';
                });
            }
        },
        {
            label: "Enable Webhook",
            isVisible: ({ webhook }) => webhook.disabled,
            action: ({ stage, webhook }) => {
                this.ngZone.run(() => {
                    webhook.disabled = false;
                    this.renderGraph();
                });
            }
        },
        {
            label: "Disable Webhook",
            isVisible: ({ webhook }) => !webhook.disabled,
            action: ({ stage, webhook }) => {
                this.ngZone.run(() => {
                    webhook.disabled = true;
                    this.renderGraph();
                });
            }
        },
        {
            label: "Delete Webhook",
            action: ({ stage, webhook }) => {
                this.ngZone.run(() => {
                    stage.webhooks.splice(stage.webhooks.indexOf(webhook), 1);
                    this.dataChangeEmitter.next(0);
                    this.renderGraph();
                    this.selectStage(stage);
                });
            }
        }
    ];

    mode: "edit" | "view" = "edit";
    view: string = "";
    selectedStage: PipelineStage;
    selectedSource: PipelineSource;
    selectedWebhook: Webhook;

    users = [];

    dataChangeEmitter = new Subject();
    dataChange$ = this.dataChangeEmitter.pipe(debounceTime(500));

    subscriptions = [
        // Save partial changes every 3s
        this.dataChange$.subscribe(() => {
            this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
                stages: this.pipeline.stages
            });
        })
    ]

    constructor(
        private readonly injector: Injector,
        private readonly appRef: ApplicationRef,
        public readonly fs: FileUploadService,
        private readonly dialog: MatDialog,
        private readonly fetch: Fetch,
        private readonly toaster: ToastrService,
        private readonly user: UserService,
        private readonly ngZone: NgZone
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
            const p = await this.fetch.post<PipelineDefinition>(`/api/odata/pipeline`, {
                ...pipeline,
                _sourceId: this.pipeline_id,
                id: undefined,
                _isUserEditInstance: true,
                _userEditing: this.user.value.login
            });
            this.initPipelineObject(p);
        }

        this.view = "pipeline";
        if (this.pipeline.id) {
            this.renderGraph();
        }
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    private initPipelineObject(p: PipelineDefinition) {

        p.sources ??= [];
        p.stages ??= [];

        if (p.stages.length == 0) {
            p.stages.push({
                id: ulid(),
                label: "Stage 1",
                renderMode: "normal",
                order: 0,
                jobs: [
                    {
                        id: ulid(),
                        taskGroups: [
                            {
                                id: ulid(),
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

    // Apply the changes of the cloned pipeline
    async save() {
        let data = {
            ...this.pipeline,
            id: this.pipeline['_sourceId'],
            _isUserEditInstance: undefined,
            _userEditing: undefined,
            _sourceId: undefined,
            "@odata.editLink": undefined,
            "@odata.id": undefined
        };

        if (data.state == "new")
            data.state = "paused";

        await this.fetch.put(`/api/odata/${this.pipeline['_sourceId']}`, data) as any;
        await this.fetch.delete(`/api/odata/${this.pipeline.id}`);

        location.href = "#/Pipelines";
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

        location.href = "#/Pipelines";
    }

    selectStage(stage: PipelineStage) {
        this.selectedSource = null;
        // This prevents zone detection loss
        // Should be removed when the react bridge no longer drops zone
        this.ngZone.run(() => {
            stage.stageTrigger ??= [];
            stage.webhooks ??= [];

            this.selectedStage = stage;
            this.renderGraph();
        })
    }

    async addStage(partial: Partial<PipelineStage> = {}) {
        this.pipeline.stages ??= [];
        const stage = {
            id: ulid(),
            label: 'Stage - ' + (this.pipeline.stages.length + 1),
            order: this.pipeline.stages.length,
            jobs: [],
            ...partial
        } as any;

        this.pipeline.stages.push(stage);

        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    async cloneStage(stage: PipelineStage) {
        const newStage = structuredClone(stage);
        newStage.id = ulid();
        newStage.label += " (clone)";

        this.pipeline.stages.push(newStage);

        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    filterPrecedingStages(stage: PipelineStage) {
        return this.pipeline.stages
            .filter(s => s.id != stage.id);
    }

    filterMissingPrecedingStages(stage: PipelineStage) {
        const stages = this.pipeline.stages;

        return stage.stageTrigger?.filter(st => !stages.find(s => s.id == st));
    }

    addWebhook(stage: PipelineStage) {
        stage.webhooks ??= [];
        stage.webhooks.push(this.selectedWebhook = {
            id: ulid(),
            label: "",
            method: "GET",
            headers: []
        });
        this.view = "webhook";
        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    deleteWebhook(stage: PipelineStage, webhook: Webhook) {
        stage.webhooks.splice(stage.webhooks.indexOf(webhook), 1);
        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    addSource(stage: PipelineStage) {
        stage.sources ??= [];
        stage.sources.push(this.selectedSource = {
            id: ulid(),
            label: "",
            targetPath: '.',
            cloneDepth: 1
        });
        this.view = "source";
        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    deleteSource(stage: PipelineStage, source: PipelineSource) {
        stage.sources.splice(stage.sources.indexOf(source), 1);

        this.view = "stage";
        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    editStage(stage: PipelineStage) {
        this.editingStage = true;
        this.selectedStage = stage;
    }

    deleteStage(stage: PipelineStage) {
        this.pipeline.stages = this.pipeline.stages.filter(s => s != stage);

        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    disableStage(stage: PipelineStage) {
        stage.disabled = true;
        this.dataChangeEmitter.next(0);
        this.renderGraph();
    }

    enableStage(stage: PipelineStage) {
        stage.disabled = false;
        this.dataChangeEmitter.next(0);

        this.renderGraph();
    }

    renderGraph() {
        if (!this.pipeline) return;
        let hasImpossibleNodes = false;

        const edges: Edge[] = [];
        const sourceNodes: Node[] = [];
        const nodes: Node[] = this.pipeline.stages?.map(stage => {
            const stageUlid = stage.id;

            stage.stageTrigger ??= [];
            for (const precedingStageId of stage.stageTrigger) {
                // The taskGroup exists and can be mapped
                let isMissingPreReq = false;
                if (!this.pipeline.stages.find(tg => tg.id == precedingStageId)) {
                    hasImpossibleNodes = true;
                    isMissingPreReq = true;
                }

                const source = isMissingPreReq ? '_impossible' : precedingStageId;

                edges.push({
                    source: source,
                    target: stageUlid,
                    id: source + "_" + stageUlid,
                    type: "bezier",
                    style: {
                        strokeWidth: 2,
                        stroke: isMissingPreReq ? '#f44336' : '#00c7ff',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 16,
                        height: 16,
                        color: isMissingPreReq ? '#f44336' : '#00c7ff'
                    },
                    data: {
                        source: this.pipeline.stages.find(s => s.id == precedingStageId),
                        target: stage
                    }
                });
            }

            // Create nodes for all of the sources for the specified stage
            if (stage.sources?.length > 0) {
                edges.push({
                    source: "source_" + stage.id,
                    target: stageUlid,
                    id: "source_edge_" + stage.id,
                    type: "bezier",
                    sourceHandle: "source",
                    style: {
                        strokeWidth: 2,
                        stroke: '#9e9e9e',
                        opacity: stage.sources.every(s => s.disabled) || stage.disabled ? .5 : 1
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 16,
                        height: 16,
                        color: '#9e9e9e',
                    },
                    data: { target: stage }
                });

                const height = stage.sources.length * 36;
                sourceNodes.push({
                    id: "source_" + stage.id,
                    width: 200,
                    height,
                    type: "source",
                    data: {
                        stage,
                        releaseEditor: this
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        '--height': height + 'px'
                    } as any
                });
            }

            if (stage.webhooks?.length > 0) {
                edges.push({
                    target: "webhook_" + stage.id,
                    source: stageUlid,
                    id: "webhook_edge_" + stage.id,
                    type: "bezier",
                    style: {
                        strokeWidth: 2,
                        stroke: '#9e9e9e',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 16,
                        height: 16,
                        color: '#9e9e9e'
                    },
                    data: { source: stage }
                });

                const height = stage.webhooks.length * 36;
                sourceNodes.push({
                    id: "webhook_" + stage.id,
                    width: 200,
                    height,
                    type: "webhook",
                    data: {
                        stage,
                        releaseEditor: this
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        '--height': height + 'px'
                    } as any
                });
            }

            return {
                id: stageUlid,
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
                position: { x: 0, y: 0 }
            }
        }) ?? [];

        if (hasImpossibleNodes) {
            nodes.push({
                id: "_impossible",
                width: 64,
                height: 64,
                type: "impossible",
                data: { },
                position: { x: 0, y: 0 }
            });
        }
        nodes.splice(-1, 0, ...sourceNodes);

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

        console.log({ nodes, edges })

        this.edges = edges;
        this.nodes = nodes;
    }

    getHost(url: string) {
        try {
            return new URL(url).host
        }
        catch {
            return "New Webhook"
        }
    }
}
