import { Component, Input, OnInit } from '@angular/core';
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
import { NgForOf, NgIf } from '@angular/common';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { PipelineJob, PipelineStage } from 'types/pipeline';
import { AccordionListComponent } from 'client/app/pages/@editors/pipeline-editor/accordion-list/accordion-list.component';
import { PipelineEditorComponent } from 'client/app/pages/@editors/pipeline-editor/pipeline-editor.component';


@Component({
    selector: 'app-job-editor',
    templateUrl: './job-editor.component.html',
    styleUrls: ['./job-editor.component.scss'],
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
        AccordionListComponent
    ],
    standalone: true
})
export class JobEditorComponent implements OnInit {

    @Input() job: PipelineJob;
    @Input() stage: PipelineStage;

    constructor(
        private fetch: Fetch,
        public pipelineEditor: PipelineEditorComponent
    ) {

    }

    ngOnInit() {
    }
}
