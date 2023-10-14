import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { VscodeComponent } from '@dotglitch/ngx-web-components';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { NgForOf, NgIf } from '@angular/common';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { PipelineTask } from 'types/pipeline';
import { StackEditorComponent } from 'ngx-stackedit';

@Component({
    selector: 'app-task-editor',
    templateUrl: './task-editor.component.html',
    styleUrls: ['./task-editor.component.scss'],
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
        StackEditorComponent
    ],
    standalone: true
})
export class TaskEditorComponent implements OnInit {

    @Input() task: PipelineTask;

    constructor() { }

    ngOnInit() {
    }

}
