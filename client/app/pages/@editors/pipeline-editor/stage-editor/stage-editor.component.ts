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
import { PipelineSourceComponent } from 'client/app/components/pipeline-source/pipeline-source.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgxAppMenuDirective, NgxContextMenuDirective } from '@dotglitch/ngx-ctx-menu';
import { Fetch } from 'client/app/services/fetch.service';
import { PipelineStage } from 'types/pipeline';

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
        MatExpansionModule,
        DragDropModule,
        FormsModule,
        VscodeComponent,
        PipelineSourceComponent,
        EditEnvironmentVariablesComponent,
        NgxAppMenuDirective,
        NgxContextMenuDirective
    ],
    standalone: true
})
export class StageEditorComponent implements OnInit {

    @Input() stage: PipelineStage;

    constructor(
        private fetch: Fetch
    ) { }

    ngOnInit() {
        console.log(this.stage)
    }

    create() {
        // this.parent.onEntryEdit({ parent: this.item.id, location: this.item.location, order: this.items.length + 1 });
    }
}
