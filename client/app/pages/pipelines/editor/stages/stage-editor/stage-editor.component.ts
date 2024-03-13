import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'types/pipeline';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FormioWrapperComponent } from 'client/app/components/formio-wrapper/formio-wrapper.component';
import { Schemas, DefaultSchema } from './task-schemas';
import { StackEditorComponent } from 'ngx-stackedit';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-stage-editor',
    standalone: true,
    imports: [
        MatExpansionModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTabsModule,
        MatTooltipModule,
        FormsModule,
        DragDropModule,
        NgScrollbarModule,
        FormioWrapperComponent,
        StackEditorComponent,
        MenuDirective
    ],
    templateUrl: './stage-editor.component.html',
    styleUrl: './stage-editor.component.scss'
})
export class StageEditorComponent {

    @Input() pipeline: PipelineDefinition = {} as any;
    @Input() stage: StageDefinition = {} as any;

    selectedJob: JobDefinition;
    selectedTaskGroup: TaskGroupDefinition;
    selectedTask: TaskDefinition;
    selectedTaskSchema: Object;

    currentSelection: "pipeline" | "stage" | "job" | "taskGroup" | "task" = 'task';

    jobMenu: MenuItem<JobDefinition>[] = [
        { label: "Delete Job", action: item => this.deleteJob(item) }
    ];
    taskGroupMenu: MenuItem<{ job: JobDefinition, taskGroup: TaskGroupDefinition}>[] = [
        { label: "Delete Task Group", action: item => this.deleteTaskGroup(item.job, item.taskGroup) }
    ];
    taskMenu: MenuItem<{ taskGroup: TaskGroupDefinition, task: TaskDefinition}>[] = [
        { label: "Delete Task", action: item => this.deleteTask(item.taskGroup, item.task) }
    ];

    constructor(
        private readonly fetch: Fetch
    ) {

    }

    ngOnInit() {
        if (!this.stage) return;

        this.stage.jobs = this.stage.jobs ?? [];

        // Attempt to auto pick the first task.
        this.selectTask(this.stage.jobs?.[0]?.taskGroups?.[0]?.tasks?.[0])
    }

    async addJob() {
        this.stage.jobs = this.stage.jobs ?? [];
        const job = {
            id: "pipeline_job:" + ulid(),
            label: 'Job - ' + (this.stage.jobs.length + 1),
            order: this.stage.jobs.length + 1,
            taskGroups: [
                {
                    id: `pipelineTaskGroup:${ulid()}`,
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
    }

    async deleteJob(job: JobDefinition) {
        this.stage.jobs = this.stage.jobs.filter(j => j != job);
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addTaskGroup(job: JobDefinition) {
        job.taskGroups = job.taskGroups ?? [];

        const taskGroup = {
            id: "pipeline_task_group:" + ulid(),
            label: 'Task Group - ' + (job.taskGroups.length + 1),
            order: job.taskGroups.length + 1,
            tasks: []
        } as TaskGroupDefinition;

        job.taskGroups.push(taskGroup);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async deleteTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        job.taskGroups = job.taskGroups.filter(tg => tg != taskGroup);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    addTask(taskGroup: TaskGroupDefinition) {
        taskGroup.tasks = taskGroup.tasks ?? [];

        const task = {
            id: "pipeline_task:" + ulid(),
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            order: taskGroup.tasks.length + 1,
            taskScriptArguments: {}
        } as TaskDefinition;

        taskGroup.tasks.push(task);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async deleteTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks = taskGroup.tasks.filter(t => t != task);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async taskDrop(taskGroup: TaskGroupDefinition, event: CdkDragDrop<any, any, any>) {
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
        // Item moved to a new parent
        else {
            // This is equally terrible and amazing. Please arrest me.
            const objects = [
                this.pipeline,
                ...this.pipeline.stages,
                ...this.pipeline.stages.map(s => s.jobs),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups).flat()),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups.map(g => g.tasks).flat()).flat()),
            ].flat();


            const [kind, id] = event.previousContainer.data.split(':');

            let subKey = '';

            // This will only run for things _below_ a pipeline. Do not worry about stages.
            if (kind == "pipelineStage") {
                subKey = 'jobs';
            }
            else if (kind == "pipelineJob") {
                subKey = 'taskGroups';
            }
            else if (kind == "pipelineTaskGroup") {
                subKey = 'tasks';
            }

            const originalParent = objects.find(o => o.id == event.previousContainer.data);
            const targetParent = objects.find(o => o.id == event.container.data);

            const oArr = originalParent[subKey];
            const tArr = targetParent[subKey];

            transferArrayItem(
                oArr,
                tArr,
                event.previousIndex,
                event.currentIndex,
            );

            // this.items.map(i => ({ id: i.id, data: { order: i.order } }))
            // Update the order of all of the items
            this.fetch.patch(`/api/odata`, [
                { id: event.previousContainer.data, data: { [subKey]: oArr.map(t => t.id) } },
                { id: event.container.data, data: { [subKey]: tArr.map(t => t.id) } }
            ]);
        }
    }

    selectJob(job: JobDefinition) {
        this.selectedJob = job;
        this.currentSelection = 'job';
    }

    selectTaskGroup(taskGroup: TaskGroupDefinition) {
        this.selectedTaskGroup = taskGroup;
        this.currentSelection = 'taskGroup';
    }

    selectTask(task: TaskDefinition) {
        // Ensure that the task has the proper argument object
        if (!task.taskScriptArguments) task.taskScriptArguments = {};

        this.selectedTask = task;
        this.selectedTaskSchema = Schemas.find(s => s.kind == task.taskScriptId) || DefaultSchema;
        this.currentSelection = 'task';
    }
}
