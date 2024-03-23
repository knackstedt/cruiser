import { ApplicationRef, ElementRef, Input, ViewChild, Injector, Component } from '@angular/core';
import { Fetch, MenuItem, ReactMagicWrapperComponent, VscodeComponent } from '@dotglitch/ngx-common';
import { ReactFlowComponent } from './reactflow/reactflow-wrapper';
import { SourceConfiguration, StageDefinition, Webhook } from 'types/pipeline';
import { ulid } from 'ulidx';
import { Edge, Handle, Node, Position } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { StageNodeComponent } from 'client/app/pages/releases/release-editor/stage-node/stage-node.component';
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
import { FileUploadService } from 'client/app/services/file-upload.service';
import { MatDialog } from '@angular/material/dialog';
import { StageEditorComponent } from 'client/app/pages/pipelines/editor/stages/stage-editor/stage-editor.component';
import { ToastrService } from 'ngx-toastr';
import { UserService } from 'client/app/services/user.service';
import { PipelineEditorPartial } from 'client/app/utils/pipeline-editor.partial';
import { VariablesSectionComponent } from 'client/app/components/variables-section/variables-section.component';


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
        FormsModule
    ],
    templateUrl: './release-editor.component.html',
    styleUrl: './release-editor.component.scss'
})
export class StagesComponent extends PipelineEditorPartial {
    @ViewChild("canvas") canvasRef: ElementRef<any>

    override readonly pipelineKind = "release";

    get container() { return this.canvasRef.nativeElement }

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
                onEditStage:         ({ stage }) => this.editStage(this.selectedStage),

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
        fetch: Fetch,
        toaster: ToastrService,
        user: UserService
    ) {
        super(toaster, fetch, user);
        fetch.get<{value: any[]}>(`/api/odata/users`).then(data => {
            this.users = data.value;
        })
    }

    async ngAfterViewInit() {
        if (!this.pipeline.id) return;
        this.renderGraph();
    }

    override async ngOnInit(): Promise<void> {
        await super.ngOnInit();

        if (this.pipeline.id) {
            this.renderGraph();
        }
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
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
        firstValueFrom(this.dialog.open(StageEditorComponent, {
            data: {
                pipeline: this.pipeline,
                stage
            },
            width: "90vw",
            height: "90vh"
        }).afterClosed())
            .then(res => {
                this.patchPipeline();
                this.renderGraph();
            })
    }

    async deleteStage(stage) {
        this.pipeline.stages = this.pipeline.stages.filter(s => s != stage);

        this.patchPipeline();
        this.renderGraph();
    }

    renderGraph() {
        if (!this.pipeline) return;

        const edges: Edge[] = [];
        const nodes: Node[] = this.pipeline.stages?.map(stage => {
            for (const precedingStageId of (stage.stageTrigger ?? [])) {
                edges.push({
                    source: precedingStageId.split(':')[1],
                    target: stage.id.split(':')[1],
                    id: precedingStageId.split(':')[1] + "_" + stage.id.split(':')[1],
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
                width: stage?.renderAsGateway ? 80 : 200,
                height: 80,
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
