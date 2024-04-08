import { DragDropModule } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { JobDefinition, TaskGroupDefinition } from 'src/types/pipeline';

@Component({
    selector: 'app-task-group-node',
    templateUrl: './task-group-node.component.html',
    styleUrl: './task-group-node.component.scss',
    imports: [
        DragDropModule,
        MenuDirective,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule
    ],
    host: {
        "class": 'nodrag',
        "(click)": "onTaskGroupSelect.emit({ job, taskGroup })",
    },
    standalone: true,
})
export class TaskGroupNodeComponent {
    @Input('data') set data ({ job, taskGroup }) {
        this.job = job;
        this.taskGroup = taskGroup;

        this.peers = this.job.taskGroups.map(tg => tg.id);
    }

    job: JobDefinition;
    taskGroup: TaskGroupDefinition;
    peers: string[] = [];

    @Input() taskGroupMenu: MenuItem[];
    @Input() taskMenu: MenuItem[];
    @Input() dropListGroup: string[];

    @Output() onAddTask = new EventEmitter();
    @Output() onTaskClick = new EventEmitter();
    @Output() onTaskGroupSelect = new EventEmitter();
    @Output() onTaskDrop = new EventEmitter();
}
