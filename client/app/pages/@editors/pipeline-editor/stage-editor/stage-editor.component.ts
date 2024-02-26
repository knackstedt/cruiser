import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { VscodeComponent } from '@dotglitch/ngx-common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { NgForOf, NgIf } from '@angular/common';
import { EditEnvironmentVariablesComponent } from 'client/app/pages/@editors/environment-variable/environment-variables.component';
import { Fetch, MenuDirective } from '@dotglitch/ngx-common';
import { StageDefinition } from 'types/pipeline';
import { AccordionListComponent } from 'client/app/pages/@editors/pipeline-editor/accordion-list/accordion-list.component';
import { PipelineEditorComponent } from 'client/app/pages/@editors/pipeline-editor/pipeline-editor.component';
import { StackEditorComponent } from 'ngx-stackedit';

@Component({
    selector: 'app-stage-editor',
    templateUrl: './stage-editor.component.html',
    styleUrls: ['./stage-editor.component.scss'],
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
        MenuDirective,
        AccordionListComponent,
        StackEditorComponent
    ],
    standalone: true
})
export class StageEditorComponent implements OnInit {

    @Input() stage: StageDefinition;

    constructor(
        private fetch: Fetch,
        public pipelineEditor: PipelineEditorComponent
    ) { }

    ngOnInit() {
        console.log(this.stage)
    }

    create() {
        // this.parent.onEntryEdit({ parent: this.item.id, location: this.item.location, order: this.items.length + 1 });
    }
}
