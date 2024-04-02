import { Component, Input } from '@angular/core';
import { Fetch } from '@dotglitch/ngx-common';
import { UserService } from 'client/app/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { PipelineDefinition } from 'types/pipeline';
import { ulid } from 'ulidx';

@Component({ template: '' })
export class PipelineEditorPartial {

    readonly pipelineKind: "build" | "release" = "build";

    // Incoming pipeline
    @Input() pipeline_id: string;
    @Input('pipeline') _pipeline: PipelineDefinition;
    @Input('new') isNewPipeline: any;

    /**
     * Cloned instance of the pipeline.
     */
    public pipeline: PipelineDefinition = {} as any;
    isUnsavedState = false;
    isRestoredSave = false;

    constructor(
        protected readonly toaster: ToastrService,
        protected readonly fetch: Fetch,
        protected readonly user: UserService
    ) {

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

    async ngOnInit() {
        if (this.pipeline_id && (this._pipeline as any) != "new" && !this._pipeline) {
            this.fetch.get(`/api/odata/${this.pipeline_id}`)
                .then(res => {
                    if (res == null) {
                        this.pipeline_id = null;
                    }
                    else {
                        this._pipeline = res as any;
                    }
                    this.ngOnInit();
                })
                .catch(err => {
                    this.toaster.error(this.pipeline_id, "Failed to load pipeline");
                });
            return;
        }

        if (typeof this._pipeline?.id == "string") {
            const url = `/api/odata/pipeline?$filter=_isUserEditInstance eq true and _sourceId eq '${this._pipeline.id}' and _userEditing eq '${this.user.value.login}'`;
            const previouslyEdited = await this.fetch.get<any>(url);

            if (previouslyEdited.value.length > 0) {
                this.initPipelineObject(previouslyEdited.value[0]);

                this.isUnsavedState = true;
                this.isRestoredSave = true;
            }
            else {
                const p = await this.fetch.put<PipelineDefinition>(`/api/odata/pipeline:${ulid()}`, {
                    ...this._pipeline,
                    _sourceId: this._pipeline.id,
                    id: undefined,
                    kind: this.pipelineKind,
                    _isUserEditInstance: true,
                    _userEditing: this.user.value.login
                });
                this.initPipelineObject(p);
            }
        }
        else {
            const p = await this.fetch.post<PipelineDefinition>(`/api/odata/pipeline/`, {
                label: 'My new Pipeline',
                state: 'new',
                kind: this.pipelineKind,
                _isUserEditInstance: true,
                _userEditing: this.user.value.login,
                order: -1,
                group: this._pipeline?.group || 'default',
                stages: [],
                sources: []
            });
            // this._pipeline.id = `pipeline:${ulid()}`;

            // Update the URL to reflect the current scope.

            this.initPipelineObject(p);

            if (location.href.includes("/new"))
                history.replaceState({}, null, location.href.replace('/new', '/' + this.pipeline.id));
        }
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
            id: this._pipeline.id,
            _isUserEditInstance: undefined,
            _sourceId: undefined,
            "@odata.editLink": undefined,
            "@odata.id": undefined
        };
        const res = await this.fetch.put(`/api/odata/${this._pipeline.id ?? ('pipeline:' + ulid())}`, data) as any;
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

}
