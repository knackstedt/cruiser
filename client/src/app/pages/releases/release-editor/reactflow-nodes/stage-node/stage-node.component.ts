import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { PipelineStage } from 'src/types/pipeline';

@Component({
    selector: 'app-stage-node',
    templateUrl: './stage-node.component.html',
    styleUrls: ['./stage-node.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MenuDirective
    ],
    standalone: true
})
export class StageNodeComponent {

    @Input('data') stage: PipelineStage;
    @Input() editing = true;
    @Input() contextMenu: MenuItem[] = [];

    @Output() onEditStage = new EventEmitter();
    @Output() onPrerequisiteClick = new EventEmitter();
    @Output() onJobsClick = new EventEmitter();
    @Output() onNodeClick = new EventEmitter();

    @Output() onSourceClick = new EventEmitter();
    @Output() onSourceEditClick = new EventEmitter();

    @Output() onScheduleClick = new EventEmitter();
    @Output() onScheduleEditClick = new EventEmitter();

    @Output() onTriggerClick = new EventEmitter();
    @Output() onTriggerEditClick = new EventEmitter();

    @Output() onManualRunClick = new EventEmitter();

    @Output() onApproverClick = new EventEmitter();
    @Output() onApproverEditClick = new EventEmitter();

    @Output() onWebhookEditClick = new EventEmitter();
    @Output() onWebhookClick = new EventEmitter();

    @Output() onStageAddClick = new EventEmitter();
    @Output() onStageCloneClick = new EventEmitter();

    taskCount = 0;

    constructor(
        private readonly matDialog: MatDialog
    ) { }

    ngOnInit() {
        this.stage.jobs.forEach(j =>
            j.taskGroups.forEach(tg =>
                this.taskCount += tg.tasks?.length ?? 0
            )
        )
    }

    ngAfterViewInit() {

    }

    editStage(stage?) {
        this.onEditStage.next({stage: this.stage});
    }
}
