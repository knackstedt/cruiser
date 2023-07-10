import { NgForOf, NgIf } from '@angular/common';
import { Component, Inject, Input, OnInit, Optional } from '@angular/core';
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
import { EnvironmentVariableComponent } from 'client/app/components/environment-variable/environment-variable.component';
import { Pipeline } from 'client/types/pipeline';
import { DialogService } from 'client/app/services/dialog.service';

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
        EnvironmentVariableComponent
    ],
    standalone: true
})
export class PipelineEditorComponent implements OnInit {

    @Input() pipeline: Pipeline;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any = {},
        @Optional() public dialogRef: MatDialogRef<any>,
        private fetch: Fetch,
        private dialog: DialogService
    ) {
    }

    ngOnInit() {

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
    createEnvironmentVariable() {
        this.dialog.open("", )
    };
}
