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
import { PipelineSourceComponent } from 'client/app/components/pipeline-source/pipeline-source.component';
import { DialogService } from 'client/app/services/dialog.service';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { Pipeline } from 'types/pipeline';

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
        PipelineSourceComponent,
        EditEnvironmentVariablesComponent
    ],
    standalone: true
})
export class PipelineEditorComponent implements OnInit {

    @ViewChild("nameInput") nameInputRef: ElementRef;

    private _pipeline: Pipeline;
    private _originalPipeline: Pipeline;
    @Input() set pipeline(val: Pipeline) {
        this._originalPipeline = val;
        // Detach object references.
        this._pipeline = structuredClone(val);
    };
    get pipeline() { return this._pipeline };

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any = {},
        @Optional() public dialogRef: MatDialogRef<any>,
        private fetch: Fetch,
        private dialog: DialogService
    ) {
    }

    ngOnInit() {

    }

    ngAfterViewInit() {
        this.nameInputRef?.nativeElement?.focus();
    }

    async save() {
        const res = await this.fetch.post(`/api/pipeline/${1}`, this.pipeline);

        this.dialogRef?.close(res);
    }


    createSource() {
        this.dialog.open("", )
    };
    createStage() {
        this.dialog.open("", )
    };

    tryClose() {
        this.dialogRef.close()
        // Alert("are you sure you want to close")
    }
}
