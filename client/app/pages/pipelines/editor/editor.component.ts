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
import { StackEditorComponent } from 'ngx-stackedit';
import { BehaviorSubject } from 'rxjs';
import { SourceConfiguration } from 'types/pipeline';
import { ulid } from 'ulidx';
import { UserService } from 'client/app/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { PipelineEditorPartial } from 'client/app/utils/pipeline-editor.partial';
import { StagesComponent } from 'client/app/pages/releases/release-editor/release-editor.component';

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
        StageEditorComponent
    ],
    standalone: true
})
export class PipelineEditorComponent extends PipelineEditorPartial {

    ngxShowDistractor$ = new BehaviorSubject(false);

    constructor(
        @Optional() public dialogRef: MatDialogRef<any>,
        toaster: ToastrService,
        fetch: Fetch,
        user: UserService
    ) {
        super(toaster, fetch, user);
    }


    async addSource() {
        const source = {
            id: "pipeline_source:" + ulid(),
            label: 'Source - ' + (this.pipeline.sources.length + 1),
            order: this.pipeline.sources.length + 1
        } as SourceConfiguration;

        this.pipeline.sources.push(source);

        this.patchPipeline();
    }

    async editSource(source: SourceConfiguration) {
        // this.tabIndex = 5;
        // this.selectedSource = source;
    }

    async deleteSource(source: SourceConfiguration) {
        this.pipeline.sources.splice(this.pipeline.sources.findIndex(s => s == source), 1);

        this.patchPipeline();
    }
}
