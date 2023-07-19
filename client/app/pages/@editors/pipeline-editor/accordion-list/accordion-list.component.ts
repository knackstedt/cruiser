import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NgForOf, NgIf, NgTemplateOutlet } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, OnInit, Output, TemplateRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { Fetch } from 'client/app/services/fetch.service';
import { Pipeline } from 'types/pipeline';

@Component({
    selector: 'app-accordion-list',
    templateUrl: './accordion-list.component.html',
    styleUrls: ['./accordion-list.component.scss'],
    imports: [
        NgIf,
        NgForOf,
        NgTemplateOutlet,
        DragDropModule,
        MatExpansionModule,
        MatButtonModule,
        MatIconModule
    ],
    standalone: true
})
export class AccordionListComponent implements OnInit {
    @ContentChild("header", { read: TemplateRef }) header: TemplateRef<any>;
    @ContentChild("content", { read: TemplateRef }) content: TemplateRef<any>;

    @Input() pipeline: Pipeline;
    @Input() id: string = '';
    @Input() peers: any[] = [];
    @Input() items: any[] = [];
    @Input() typeName: string;
    @Input() dropListGroup: string;

    @Output() onCreate = new EventEmitter();

    constructor(
        private fetch: Fetch
    ) { }

    ngOnInit() {
    }

    async drop(event: CdkDragDrop<any, any, any>) {
        // Simple reordering
        if (event.previousContainer === event.container) {
            if (event.previousIndex == event.currentIndex) return;

            // Update the array position after the data is updated in the backend
            moveItemInArray(this.items, event.previousIndex, event.currentIndex);

            this.items.forEach((item, index) => {
                item.order = index;
            });

            // Update the order of all of the items
            this.fetch.patch(`/api/db`, this.items.map(i => ({ id: i.id, data: { order: i.order } })));
        }
        // Item moved to a new parent
        else {
            // This is equally terrible and amazing. Please arrest me.
            const objects = [
                this.pipeline,
                ...this.pipeline.stages,
                ...this.pipeline.stages.map(s => s.jobs),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups).flat()),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups.map(g => g.tasks).flat()).flat()),
            ].flat();


            const [kind, id] = event.previousContainer.data.split(':');

            let subKey = '';

            // This will only run for things _below_ a pipeline. Do not worry about stages.
            if (kind == "pipelineStage") {
                subKey = 'jobs';
            }
            else if (kind == "pipelineJob") {
                subKey = 'taskGroups';
            }
            else if (kind == "pipelineTaskGroup") {
                subKey = 'tasks';
            }

            const originalParent = objects.find(o => o.id == event.previousContainer.data);
            const targetParent = objects.find(o => o.id == event.container.data);

            const oArr = originalParent[subKey];
            const tArr = targetParent[subKey];

            transferArrayItem(
                oArr,
                tArr,
                event.previousIndex,
                event.currentIndex,
            );

            // this.items.map(i => ({ id: i.id, data: { order: i.order } }))
            // Update the order of all of the items
            this.fetch.patch(`/api/db`, [
                { id: event.previousContainer.data, data: { [subKey]: oArr.map(t => t.id) } },
                { id: event.container.data,         data: { [subKey]: tArr.map(t => t.id) } }
            ]);
        }
    }
}
