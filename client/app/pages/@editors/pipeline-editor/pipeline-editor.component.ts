import { NgForOf, NgIf } from '@angular/common';
import { Component, ElementRef, Inject, Input, OnInit, Optional, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { DialogService, Fetch } from '@dotglitch/ngx-common';
import { VscodeComponent } from '@dotglitch/ngx-common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { PipelineDefinition, JobDefinition, SourceConfiguration, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'types/pipeline';
import { BehaviorSubject } from 'rxjs';
import { LazyLoaderComponent, LazyLoaderService } from '@dotglitch/ngx-common';
import { AccordionListComponent } from 'client/app/pages/@editors/pipeline-editor/accordion-list/accordion-list.component';
import { LabeltemplateEditorComponent } from 'client/app/pages/@editors/pipeline-editor/labeltemplate-editor/labeltemplate-editor.component';
import { StackEditorComponent } from 'ngx-stackedit';
import { ulid } from 'ulidx';

@Component({
    selector: 'app-pipeline-editor',
    templateUrl: './pipeline-editor.component.html',
    styleUrls: ['./pipeline-editor.component.scss'],
    imports: [
        NgIf,
        NgForOf,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
        MatButtonModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MatTabsModule,
        MatCheckboxModule,
        MatRadioModule,
        FormsModule,
        VscodeComponent,
        EditEnvironmentVariablesComponent,
        LazyLoaderComponent,
        AccordionListComponent,
        LabeltemplateEditorComponent,
        StackEditorComponent
    ],
    standalone: true
})
export class PipelineEditorComponent implements OnInit {

    @ViewChild("nameInput") nameInputRef: ElementRef;

    public pipeline: PipelineDefinition;
    @Input('pipeline') _pipeline: PipelineDefinition;

    ngxShowDistractor$ = new BehaviorSubject(false);

    tabIndex = 0;
    selectedStage: StageDefinition;
    selectedJob: JobDefinition;
    selectedTaskGroup: TaskGroupDefinition;
    selectedTask: TaskDefinition;
    selectedSource: SourceConfiguration;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any = {},
        @Optional() public dialogRef: MatDialogRef<any>,
        private fetch: Fetch,
        private dialog: DialogService,
        private lazyLoader: LazyLoaderService
    ) {
        lazyLoader.registerComponent({
            id: "stage-editor",
            group: "dynamic",
            load: () => import('./stage-editor/stage-editor.component')
        });
        lazyLoader.registerComponent({
            id: "job-editor",
            group: "dynamic",
            load: () => import('./job-editor/job-editor.component')
        });
        lazyLoader.registerComponent({
            id: "task-editor",
            group: "dynamic",
            load: () => import('./task-editor/task-editor.component')
        });
        lazyLoader.registerComponent({
            id: "source-editor",
            group: "dynamic",
            load: () => import('./source-editor/source-editor.component')
        });
    }

    async ngOnInit() {
        if (typeof this._pipeline.id == "string") {
            this.pipeline = await this.fetch.put(`/api/odata/pipelines:${ulid()}`, {
                ...this._pipeline,
                id: undefined,
                isUserEditInstance: true
            });
        }
        else {
            this.pipeline = await this.fetch.post(`/api/odata/pipelines/`, {
                label: 'My new Pipeline',
                state: 'new',
                isUserEditInstance: true,
                order: -1,
                group: this._pipeline.group || 'default',
                stages: [],
                sources: []
            });
            this._pipeline.id = this.pipeline.id;
        }
    }

    ngAfterViewInit() {
        this.nameInputRef?.nativeElement?.focus();
    }

    // Apply the changes of the cloned pipeline
    async save() {
        let data = {
            ...this.pipeline,
            isUserEditInstance: false,
            id: this._pipeline.id
        }
        const res = await this.fetch.patch(`/api/odata/${this._pipeline.id}`, data) as any;

        this.dialogRef?.close(res);
    }

    // Delete the cloned pipeline
    async cancel() {
        await this.fetch.delete(`api/odata/${this.pipeline.id}`);
        this.dialogRef.close();
    }

    async addStage() {
        const stage = {
            label: 'Stage - ' + (this.pipeline.stages.length + 1),
            order: this.pipeline.stages.length,
            jobs: []
        } as any;

        this.pipeline.stages.push(stage);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    editStage(stage) {
        console.log("edit da fuckin stage yobbie")
        this.selectedStage = stage;
        this.tabIndex = 1;
    }

    async deleteStage(stage) {
        this.pipeline.stages = this.pipeline.stages.filter(s => s != stage);
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addJob(stage: StageDefinition) {
        const job = {
            label: 'Job - ' + (stage.jobs.length + 1),
            order: stage.jobs.length + 1,
            taskGroups: []
        } as JobDefinition;

        stage.jobs.push(job);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    editJob(stage: StageDefinition, job: JobDefinition) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.tabIndex = 2;
    }

    async deleteJob(stage: StageDefinition, job: JobDefinition) {
        stage.jobs = stage.jobs.filter(j => j != job);
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addTaskGroup(job: JobDefinition) {
        const taskGroup = {
            label: 'Task Group - ' + (job.taskGroups.length + 1),
            order: job.taskGroups.length + 1,
            tasks: []
        } as TaskGroupDefinition;

        job.taskGroups.push(taskGroup);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async editTaskGroup(stage: StageDefinition, job: JobDefinition, taskGroup: TaskGroupDefinition) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.selectedTaskGroup = taskGroup;
        this.tabIndex = 3;
    }

    async deleteTaskGroup(stage: StageDefinition, job: JobDefinition, taskGroup: TaskGroupDefinition) {
        job.taskGroups = job.taskGroups.filter(tg => tg != taskGroup);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addTask(taskGroup: TaskGroupDefinition) {
        const task = {
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            command: "",
            arguments: [],
            order: taskGroup.tasks.length + 1
        } as TaskDefinition;

        taskGroup.tasks.push(task);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async editTask(stage: StageDefinition, job: JobDefinition, taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.selectedTaskGroup = taskGroup;
        this.selectedTask = task;
        this.tabIndex = 4;
    }

    async deleteTask(stage: StageDefinition, job: JobDefinition, taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks = taskGroup.tasks.filter(t => t != task);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addSource() {
        const source = {
            label: 'Source - ' + (this.pipeline.sources.length + 1),
            order: this.pipeline.sources.length + 1
        } as SourceConfiguration;

        this.pipeline.sources.push(source);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            sources: this.pipeline.sources
        });
    }

    async editSource(source: SourceConfiguration) {
        this.tabIndex = 5;
        this.selectedSource = source;
    }

    async deleteSource(source: SourceConfiguration) {
        this.pipeline.sources.splice(this.pipeline.sources.findIndex(s => s == source), 1);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            sources: this.pipeline.sources
        });
    }

    getStagePeers() { return this.pipeline.stages}
    getJobPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.id)).flat()}
    getTaskGroupPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.id))).flat()}
    getTaskPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.tasks?.map(t => t.id)))).flat()}

    tryClose() {
        this.dialogRef.close()
        // Alert("are you sure you want to close")
    }
}
