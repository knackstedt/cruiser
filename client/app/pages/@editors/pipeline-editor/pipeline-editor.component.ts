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
import { Fetch } from 'client/app/services/fetch.service';
import { VscodeComponent } from '@dotglitch/ngx-web-components';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { DialogService } from 'client/app/services/dialog.service';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { Pipeline, PipelineJob, PipelineSource, PipelineStage, PipelineTask, PipelineTaskGroup } from 'types/pipeline';
import { BehaviorSubject } from 'rxjs';
import { NgxLazyLoaderComponent, NgxLazyLoaderService } from '@dotglitch/ngx-lazy-loader';
import { AccordionListComponent } from 'client/app/pages/@editors/pipeline-editor/accordion-list/accordion-list.component';

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
        NgxLazyLoaderComponent,
        AccordionListComponent
    ],
    standalone: true
})
export class PipelineEditorComponent implements OnInit {

    @ViewChild("nameInput") nameInputRef: ElementRef;

    public pipeline: Pipeline;
    @Input('pipeline') _pipeline: Pipeline;

    ngxShowDistractor$ = new BehaviorSubject(false);

    tabIndex = 0;
    selectedStage: PipelineStage;
    selectedJob: PipelineJob;
    selectedTaskGroup: PipelineTaskGroup;
    selectedTask: PipelineTask;
    selectedSource: PipelineSource;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any = {},
        @Optional() public dialogRef: MatDialogRef<any>,
        private fetch: Fetch,
        private dialog: DialogService,
        private lazyLoader: NgxLazyLoaderService
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
            // Get the full pipeline and subcontents
            // await this.fetch.patch(`/api/pipeline/${this._pipeline.id}`, {});
            this.pipeline = await this.fetch.get(`/api/pipeline/${this._pipeline.id}/editclone`);
            // this.pipeline = await this.fetch.post(`/api/pipeline/${this._pipeline.id}`);
        }
        else {
            this.pipeline = await this.fetch.post(`/api/db/pipeline/`, {
                label: 'My new Pipeline',
                state: 'new',
                isUserEditInstance: true,
                order: -1,
                group: this._pipeline.group || 'default',
                stages: []
            });
        }
    }

    ngAfterViewInit() {
        this.nameInputRef?.nativeElement?.focus();
    }

    async save() {
        const [res] = await this.fetch.post(`/api/pipeline/${this._pipeline.id}/applyclone`, this.pipeline) as any;

        this.dialogRef?.close(res);
    }

    async cancel() {
        await this.fetch.delete(`api/db/${this.pipeline.id}`);
        this.dialogRef.close();
    }

    async addStage() {
        const stage = await this.fetch.post(`/api/db/pipelineStage`, {
            label: 'Stage - ' + (this.pipeline.stages.length + 1),
            order: this.pipeline.stages.length,
            jobs: []
        }) as any;

        this.pipeline.stages.push(stage);

        this.fetch.patch(`/api/db/${this.pipeline.id}`, {
            stages: this.pipeline.stages.map(s => s.id)
        });
    }
    editStage(stage) {
        console.log("edit da fuckin stage yobbie")
        this.selectedStage = stage;
        this.tabIndex = 1;
    }

    async addJob(stage: PipelineStage) {
        const job = await this.fetch.post(`api/db/pipelineJob`, {
            label: 'Job - ' + (stage.jobs.length + 1),
            order: stage.jobs.length + 1,
            taskGroups: []
        }) as PipelineJob;

        stage.jobs.push(job);

        this.fetch.patch(`/api/db/${stage.id}`, {
            jobs: stage.jobs.map(s => s.id)
        });
    }

    editJob(stage: PipelineStage, job: PipelineJob) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.tabIndex = 2;
    }

    async addTaskGroup(job: PipelineJob) {
        const taskGroup = await this.fetch.post(`api/db/pipelineTaskGroup`, {
            label: 'Task Group - ' + (job.taskGroups.length + 1),
            order: job.taskGroups.length + 1,
            tasks: []
        }) as PipelineTaskGroup;

        job.taskGroups.push(taskGroup);

        this.fetch.patch(`/api/db/${job.id}`, {
            taskGroups: job.taskGroups.map(s => s.id)
        });
    }

    async editTaskGroup(stage: PipelineStage, job: PipelineJob, taskGroup: PipelineTaskGroup) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.selectedTaskGroup = taskGroup;
        this.tabIndex = 3;
    }

    async addTask(taskGroup: PipelineTaskGroup) {
        const task = await this.fetch.post(`api/db/pipelineTask`, {
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            command: "echo",
            arguments: ["foo"],
            order: taskGroup.tasks.length + 1
        }) as PipelineTask;

        taskGroup.tasks.push(task);

        this.fetch.patch(`/api/db/${taskGroup.id}`, {
            tasks: taskGroup.tasks.map(s => s.id)
        });

    }
    async editTask(stage: PipelineStage, job: PipelineJob, taskGroup: PipelineTaskGroup, task: PipelineTask) {
        this.selectedStage = stage;
        this.selectedJob = job;
        this.selectedTaskGroup = taskGroup;
        this.selectedTask = task;
        this.tabIndex = 4;
    }

    async addSource() {
        const source = await this.fetch.post(`api/db/pipelineSource`, {
            label: 'Source - ' + (this.pipeline.sources.length + 1),
            order: this.pipeline.sources.length + 1
        }) as PipelineSource;

        this.pipeline.sources.push(source);

        this.fetch.patch(`/api/db/${this.pipeline.id}`, {
            sources: this.pipeline.sources.map(s => s.id)
        });
    }
    async editSource(source: PipelineSource) {
        this.tabIndex = 5;
        this.selectedSource = source;
    }

    getStagePeers() { return this.pipeline.stages.map(s => s.id)}
    getJobPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.id)).flat()}
    getTaskGroupPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.id))).flat()}
    getTaskPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.tasks?.map(t => t.id)))).flat()}

    tryClose() {
        this.dialogRef.close()
        // Alert("are you sure you want to close")
    }
}
