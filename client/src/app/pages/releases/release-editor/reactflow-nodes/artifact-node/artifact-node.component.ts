import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { ReleaseEditorComponent } from '../../release-editor.component';
import { PipelineStage } from 'src/types/pipeline';

@Component({
    selector: 'app-artifact-node',
    templateUrl: './artifact-node.component.html',
    styleUrls: ['./artifact-node.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MenuDirective
    ],
    standalone: true
})
export class ArtifactNodeComponent {

    @Input() data: { stage: PipelineStage, releaseEditor: ReleaseEditorComponent };
    @Input() editing = true;
    @Input() contextMenu: MenuItem[] = [];

    @Output() onEditSource = new EventEmitter();

    get stage() { return this.data.stage };
    get selectedSource() { return this.data.releaseEditor?.selectedSource };
    get sources() { return this.stage.sources };
}
