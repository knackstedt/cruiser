import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ApplicationRef, Component, EventEmitter, Inject, Injector, Input, NgZone, Optional, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import dagre from '@dagrejs/dagre';
import { Fetch, MenuDirective, MenuItem, ReactMagicWrapperComponent, openMenu } from '@dotglitch/ngx-common';
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'src/types/pipeline';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FormioWrapperComponent } from 'src/app/components/formio-wrapper/formio-wrapper.component';
import { Schemas, DefaultSchema } from './task-schemas';
import { StackEditorComponent } from 'ngx-stackedit';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { VariablesSectionComponent } from 'src/app/components/variables-section/variables-section.component';
import { ArtifactsSectionComponent } from 'src/app/components/artifacts-section/artifacts-section.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ReactFlowComponent } from 'src/app/components/reactflow/reactflow-wrapper';
import { Edge, Handle, MarkerType, Node, Position } from 'reactflow';
import { TaskGroupNodeComponent } from '../reactflow-nodes/task-group-node/task-group-node.component';
import React from 'react';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ImpossibleNodeComponent } from '../reactflow-nodes/impossible-node/impossible-node.component';

@Component({
    selector: 'app-stage-editor',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTabsModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatSelectModule,
        MatSidenavModule,
        FormsModule,
        NgScrollbarModule,
        FormioWrapperComponent,
        StackEditorComponent,
        MenuDirective,
        VariablesSectionComponent,
        ArtifactsSectionComponent,
        ReactFlowComponent
    ],
    templateUrl: './stage-editor.component.html',
    styleUrl: './stage-editor.component.scss'
})
export class StageEditorComponent {

    readonly schemas = Object.seal(Schemas);
    readonly schemaMap = (() => {
        const m: { [key: string]: typeof Schemas[0]} = {};
        Schemas.forEach(s => m[s.kind] = s);
        return m;
    })();
    readonly defaultSchema = DefaultSchema;

    readonly defaultContainerImage = "ghcr.io/knackstedt/cruiser/cruiser-agent:latest";

    @Input() pipeline: PipelineDefinition = {} as any;
    @Input() stage: StageDefinition = {} as any;

    @Output() close = new EventEmitter();

    selectedJob: JobDefinition;
    selectedTaskGroup: TaskGroupDefinition;
    selectedTask: TaskDefinition;

    selectedJobIndex = 0;

    currentSelection: "pipeline" | "stage" | "job" | "taskGroup" | "task" = 'task';

    jobMenu: MenuItem<JobDefinition>[] = [
        { label: "Enable Job", action: item => this.enableJob(item), isVisible: item => item.disabled },
        { label: "Disable Job", action: item => this.disableJob(item), isVisible: item => !item.disabled },
        { label: "Delete Job", action: item => this.deleteJob(item) }
    ];
    taskGroupMenu: MenuItem<{ job: JobDefinition, taskGroup: TaskGroupDefinition}>[] = [
        { label: "Enable Task Group", action: item => this.enableTaskGroup(item.job, item.taskGroup), isVisible: item => item.taskGroup.disabled },
        { label: "Disable Task Group", action: item => this.disableTaskGroup(item.job, item.taskGroup), isVisible: item => !item.taskGroup.disabled },
        { label: "Delete Task Group", action: item => this.deleteTaskGroup(item.job, item.taskGroup) }
    ];
    taskMenu: MenuItem<{ taskGroup: TaskGroupDefinition, task: TaskDefinition}>[] = [
        { label: "Enable Task", action: item => this.enableTask(item.taskGroup, item.task), isVisible: item => item.task.disabled },
        { label: "Disable Task", action: item => this.disableTask(item.taskGroup, item.task), isVisible: item => !item.task.disabled },
        { label: "Delete Task", action: item => this.deleteTask(item.taskGroup, item.task) },
        { label: "Clone Task", action: item => this.cloneTask(item.taskGroup, item.task) }
    ];

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

    diagramList: {
        nodes: Node[]
        edges: Edge[]
    }[] = [];

    nodeTypes = {
        taskGroup: ReactMagicWrapperComponent.WrapAngularComponent({
            component: TaskGroupNodeComponent,
            appRef: this.appRef,
            injector: this.injector,
            ngZone: this.ngZone,
            staticInputs: {
                taskMenu: this.taskMenu,
                dropListGroup: []
            },
            staticOutputs: {
                onTaskGroupSelect: ({ job, taskGroup }) => { this.selectTaskGroup(taskGroup); },
                onTaskClick: ({ job, taskGroup, task }) => { this.selectTask(task); this.renderJobs();},
                onAddTask: ({ job, taskGroup }) => { this.addTask(taskGroup); this.renderJobs();},
                onTaskDrop: ({ job, taskGroup, event }) => { this.taskDrop(job, taskGroup, event); this.renderJobs(); },
            },
            additionalChildren: [
                React.createElement(Handle, { type: "target", position: Position.Left }),
                React.createElement(Handle, { type: "source", position: Position.Right })
            ]
        }),
        impossible: ReactMagicWrapperComponent.WrapAngularComponent({
            component: ImpossibleNodeComponent,
            appRef: this.appRef,
            injector: this.injector,
            ngZone: this.ngZone,
            additionalChildren: [
                React.createElement(Handle, { type: "source", position: Position.Right })
            ]
        })
    }

    constructor(
        private readonly fetch: Fetch,
        public  readonly fs: FileUploadService,
        public  readonly dialog: MatDialog,
        private readonly injector: Injector,
        private readonly appRef: ApplicationRef,
        private readonly ngZone: NgZone
    ) {
    }

    ngOnInit() {

        this.fetch.get("/api/")

        if (!this.stage) return;

        this.stage.jobs ??= [];

        if (this.stage.jobs.length == 0) {
            this.stage.jobs.push({
                id: ulid(),
                label: "Job 1",
                order: 0,
                taskGroups: [{
                    id: ulid(),
                    label: "Task Group 1",
                    order: 0,
                    tasks: []
                }]
            })
        }

        // Attempt to auto pick the first task.
        this.selectJob(this.stage.jobs[0]);
        this.selectTask(this.stage.jobs[0]?.taskGroups?.[0]?.tasks?.[0]);
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    private patchPipeline() {
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    // Delete the current stage and exit.
    deleteStage() {
        this.pipeline.stages = this.pipeline.stages.filter(s => s.id != this.stage.id);
        this.patchPipeline();
        this.close.emit();
    }

    async addJob() {
        this.stage.jobs ??= [];
        const job = {
            id: ulid(),
            label: 'Job - ' + (this.stage.jobs.length + 1),
            order: this.stage.jobs.length + 1,
            taskGroups: [
                {
                    id: ulid(),
                    label: "Task Group 1",
                    order: 0,
                    tasks: []
                }
            ]
        } as JobDefinition;

        this.stage.jobs.push(job);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
        this.selectJob(job);
    }

    async deleteJob(job: JobDefinition) {
        this.stage.jobs = this.stage.jobs.filter(j => j != job);
        this.patchPipeline();
    }
    async disableJob(job: JobDefinition) {
        job.disabled = true;
        this.patchPipeline();
    }
    async enableJob(job: JobDefinition) {
        job.disabled = false;
        this.patchPipeline();
    }

    async addTaskGroup(job: JobDefinition) {
        job.taskGroups ??= [];

        const taskGroup = {
            id: ulid(),
            label: 'Task Group - ' + (job.taskGroups.length + 1),
            order: job.taskGroups.length + 1,
            tasks: []
        } as TaskGroupDefinition;

        job.taskGroups.push(taskGroup);

        this.patchPipeline();
        this.selectTaskGroup(taskGroup);
        this.renderJobs();
    }

    async deleteTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        job.taskGroups = job.taskGroups.filter(tg => tg.id != taskGroup.id);

        this.patchPipeline();
        this.renderJobs()
    }
    async disableTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        taskGroup.disabled = true;

        this.patchPipeline();
    }
    async enableTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        taskGroup.disabled = false;

        this.patchPipeline();
    }

    addTask(taskGroup: TaskGroupDefinition) {
        taskGroup.tasks ??= [];

        const task = {
            id: ulid(),
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            order: taskGroup.tasks.length + 1,
            taskScriptArguments: {},
            abortGroupOnTaskFailure: true,
            breakAfterTask: false,
            breakBeforeTask: false,
            breakOnTaskFailure: true,
            breakOnTaskSuccess: false
        } as TaskDefinition;

        taskGroup.tasks.push(task);

        this.patchPipeline();
        this.selectTask(task);
    }

    async deleteTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks = taskGroup.tasks.filter(t => t != task);

        this.patchPipeline();
    }
    async disableTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        task.disabled = true;

        this.patchPipeline();
    }
    async enableTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        task.disabled = false;

        this.patchPipeline();
    }
    async cloneTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks.push(structuredClone(task));

        this.patchPipeline();
    }

    async taskDrop(job: JobDefinition, taskGroup: TaskGroupDefinition, event: CdkDragDrop<any, any, any>) {
        // Simple reordering
        if (event.previousContainer === event.container) {
            if (event.previousIndex == event.currentIndex) return;

            // Update the array position after the data is updated in the backend
            moveItemInArray(taskGroup.tasks, event.previousIndex, event.currentIndex);

            taskGroup.tasks.forEach((item, index) => {
                item.order = index;
            });

            // Update the order of all of the items
            // this.fetch.patch(`/api/odata`, taskGroup.tasks.map(i => ({ id: i.id, data: { order: i.order } })));
        }
        // task moved to a new task group
        else {
            const fromId = event.previousContainer.data as string;
            const toId = event.container.data as string;

            const originalParent = job.taskGroups.find(o => o.id == fromId);
            const targetParent = job.taskGroups.find(o => o.id == toId);

            transferArrayItem(
                originalParent.tasks,
                targetParent.tasks,
                event.previousIndex,
                event.currentIndex,
            );
        }

        this.patchPipeline();
    }

    selectJob(job: JobDefinition) {
        this.selectedJob = job;
        this.currentSelection = 'job';
        this.renderJobs();
    }

    selectTaskGroup(taskGroup: TaskGroupDefinition) {
        this.selectedTaskGroup = taskGroup;
        this.currentSelection = 'taskGroup';
    }

    selectTask(task: TaskDefinition) {
        if (!task) return;
        // Ensure that the task has the proper argument object
        if (!task.taskScriptArguments) task.taskScriptArguments = {};

        this.selectedTask = task;
        this.currentSelection = 'task';
    }

    renderJobs() {
        this.diagramList = [];
        this.stage.jobs.forEach((job, i) => this.renderGraph(job, i))
    }

    renderGraph(job: JobDefinition, i: number) {
        let hasImpossibleNodes = false;
        const edges: Edge[] = [];
        const nodes: Node[] = job.taskGroups?.map(taskGroup => {

            taskGroup.preTaskGroups ??= [];
            for (const preTaskGroupId of taskGroup.preTaskGroups) {
                // The taskGroup exists and can be mapped
                let isMissingPreReq = false;
                if (!job.taskGroups.find(tg => tg.id == preTaskGroupId)) {
                    hasImpossibleNodes = true;
                    isMissingPreReq = true;
                }

                const source = isMissingPreReq ? '_impossible' : preTaskGroupId;
                const target = taskGroup.id;

                edges.push({
                    source: source,
                    target: target,
                    id: source + "_" + target,
                    sourceHandle: "source",
                    type: "bezier",
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 16,
                        height: 16,
                        color: isMissingPreReq ? '#f44336' : '#00c7ff'
                    },
                    style: {
                        strokeWidth: 2,
                        stroke: isMissingPreReq ? '#f44336' : '#00c7ff',
                    },
                    data: {
                        source: job.taskGroups.find(s => s.id == preTaskGroupId),
                        target: taskGroup
                    }
                });
            }


            return {
                id: taskGroup.id,
                width: 320,
                height: 32 * (taskGroup.tasks?.length || 1) + 40 + 24,
                type: "taskGroup",
                data: { job, taskGroup },
                targetPosition: null,
                sourcePosition: null,
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
                data: { job },
                targetPosition: null,
                sourcePosition: null,
                position: {
                    x: 0,
                    y: 0
                }
            })
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

        this.diagramList[i] = {
            edges,
            nodes
        }
    }

    filterPrecedingTaskGroups(taskGroup: TaskGroupDefinition) {
        return this.selectedJob.taskGroups.filter(tg => tg != taskGroup);
    }

    filterMissingPrecedingTaskGroups(taskGroup: TaskGroupDefinition) {
        const jobTaskGroups = this.selectedJob.taskGroups;

        // Find all of the task groups that do not exist.
        return taskGroup.preTaskGroups?.filter(pt => !jobTaskGroups.find(jt => jt.id == pt));
    }

    onNodeCtxMenu([evt, { data }]) {
        openMenu(this.dialog, this.taskGroupMenu, data, evt);
    }
}
