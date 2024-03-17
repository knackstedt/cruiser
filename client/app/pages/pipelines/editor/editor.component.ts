import { Component, Inject, Input, OnInit, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Fetch, VscodeComponent } from '@dotglitch/ngx-common';
import { StageEditorComponent } from './stages/stage-editor/stage-editor.component';
import { StagesComponent } from 'client/app/pages/pipelines/editor/stages/stages.component';
import { StackEditorComponent } from 'ngx-stackedit';
import { BehaviorSubject } from 'rxjs';
import { JobDefinition, PipelineDefinition, SourceConfiguration, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'types/pipeline';
import { ulid } from 'ulidx';
import { UserService } from 'client/app/services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-pipeline-editor',
    templateUrl: './editor.component.html',
    styleUrls: ['./editor.component.scss'],
    imports: [
        MatTabsModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatExpansionModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatSelectModule,
        MatSlideToggleModule,
        FormsModule,
        VscodeComponent,
        StackEditorComponent,
        StagesComponent,
        StageEditorComponent,

    ],
    standalone: true
})
export class PipelineEditorComponent {

    public pipeline: PipelineDefinition = {} as any;

    @Input() pipeline_id: string;
    // Incoming pipeline
    @Input('pipeline') _pipeline: PipelineDefinition;

    ngxShowDistractor$ = new BehaviorSubject(false);

    isUnsavedState = false;
    isRestoredSave = false;


    constructor(
        @Optional() public dialogRef: MatDialogRef<any>,
        private readonly toaster: ToastrService,
        private readonly fetch: Fetch,
        private readonly user: UserService
    ) { }

    private initPipelineObject() {
        const p = this.pipeline;

        p.sources = p.sources ?? [];
        p.stages = p.stages ?? [];

        if (p.stages.length == 0) {
            p.stages.push({
                id: `pipeline_stage:${ulid() }`,
                label: "Stage 1",
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
                        order: 0,
                        platform: "kube_foo"
                    }
                ]
            })
        }

        this.pipeline = p;
    }

    async ngOnInit() {
        if (this.pipeline_id && !this._pipeline) {
            this.fetch.get(`/api/odata/${this.pipeline_id}`)
                .then(res => {
                    this._pipeline = res as any;
                    this.ngOnInit();
                })
                .catch(err => {
                    this.toaster.error(this.pipeline_id, "Failed to load pipeline")
                });
            return;
        }

        if (!this._pipeline?.id) {
            this._pipeline = {
                _isUserEditInstance: true
            } as any;
        }

        if (typeof this._pipeline.id == "string") {
            const url = `/api/odata/pipelines?$filter=_isUserEditInstance eq true and _sourceId eq '${this._pipeline.id}' and _userEditing eq '${this.user.value.login}'`;
            const previouslyEdited = await this.fetch.get<any>(url);

            if (previouslyEdited.value.length > 0) {
                this.pipeline = previouslyEdited.value[0];
                this.initPipelineObject();

                this.isUnsavedState = true;
                this.isRestoredSave = true;
            }
            else {
                this.pipeline = await this.fetch.put(`/api/odata/pipelines:${ulid()}`, {
                    ...this._pipeline,
                    _sourceId: this._pipeline.id,
                    id: undefined,
                    _isUserEditInstance: true,
                    _userEditing: this.user.value.login
                });
            }
        }
        else {
            this.pipeline = await this.fetch.post(`/api/odata/pipelines/`, {
                label: 'My new Pipeline',
                state: 'new',
                _isUserEditInstance: true,
                _userEditing: this.user.value.login,
                order: -1,
                group: this._pipeline.group || 'default',
                stages: [],
                sources: []
            });
            this._pipeline.id = `pipelines:${ulid()}`;
            this.initPipelineObject();
        }
    }

    // Apply the changes of the cloned pipeline
    async save() {
        let data = {
            ...this.pipeline,
            id: this._pipeline.id,
            _isUserEditInstance: undefined,
            _sourceId: undefined,
            "@odata.editLink": undefined,
            "@odata.id": undefined
        };
        const res = await this.fetch.put(`/api/odata/${this._pipeline.id}`, data) as any;
        await this.fetch.delete(`/api/odata/${this.pipeline.id}`);

        location.href = "#/Pipelines";
        // this.dialogRef?.close(res);
    }

    // Perform a save of the current clone
    async saveClone() {
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, this.pipeline) as any;
    }

    // Delete the cloned pipeline
    async cancel() {
        await this.fetch.delete(`api/odata/${this.pipeline.id}`);
        // this.dialogRef.close();
        location.href = "#/Pipelines";
    }

    async addSource() {
        const source = {
            id: "pipeline_source:" + ulid(),
            label: 'Source - ' + (this.pipeline.sources.length + 1),
            order: this.pipeline.sources.length + 1
        } as SourceConfiguration;

        this.pipeline.sources.push(source);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            sources: this.pipeline.sources
        });
    }

    async editSource(source: SourceConfiguration) {
        // this.tabIndex = 5;
        // this.selectedSource = source;
    }

    async deleteSource(source: SourceConfiguration) {
        this.pipeline.sources.splice(this.pipeline.sources.findIndex(s => s == source), 1);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            sources: this.pipeline.sources
        });
    }

    getStagePeers() { return this.pipeline.stages; }
    getJobPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.id)).flat(); }
    getTaskGroupPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.id))).flat(); }
    getTaskPeers() { return this.pipeline.stages.map(s => s.jobs?.map(j => j.taskGroups?.map(g => g.tasks?.map(t => t.id)))).flat(); }

    tryClose() {
        this.dialogRef.close();
        // Alert("are you sure you want to close")
    }
}
