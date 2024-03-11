import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Fetch } from '@dotglitch/ngx-common';
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'types/pipeline';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FormioWrapperComponent } from 'client/app/components/formio-wrapper/formio-wrapper.component';
import { Schemas, DefaultSchema } from './task-schemas';
import { StackEditorComponent } from 'ngx-stackedit';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-stage-editor',
    standalone: true,
    imports: [
        MatExpansionModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTabsModule,
        FormsModule,
        DragDropModule,
        NgScrollbarModule,
        FormioWrapperComponent,
        StackEditorComponent
    ],
    templateUrl: './stage-editor.component.html',
    styleUrl: './stage-editor.component.scss'
})
export class StageEditorComponent {

    @Input() pipeline: PipelineDefinition = {} as any;
    @Input() stage: StageDefinition = {} as any;

    selectedTask: TaskDefinition;
    selectedTaskSchema: Object;
    selectedJob: JobDefinition;

    currentSelection: "pipeline" | "stage" | "job" | "taskGroup" | "task" = 'task';

    constructor(
        private readonly fetch: Fetch
    ) {

    }

    ngOnInit() {
        this.stage.jobs = this.stage.jobs ?? [];

        // Attempt to auto pick the first task.
        this.selectTask(this.stage.jobs?.[0]?.taskGroups?.[0]?.tasks?.[0])
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

    addTask(taskGroup: TaskGroupDefinition) {
        const task = {
            id: "pipeline_task:" + ulid(),
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            order: taskGroup.tasks.length + 1,
            taskInstructions: {}
        } as TaskDefinition;

        taskGroup.tasks.push(task);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    selectTask(task: TaskDefinition) {
        this.selectedTask = task;
        this.selectedTaskSchema = Schemas.find(s => s.kind == task.taskKind) || DefaultSchema;
    }
}
