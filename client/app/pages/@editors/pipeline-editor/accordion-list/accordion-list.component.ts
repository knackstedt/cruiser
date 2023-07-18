import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgForOf, NgIf, NgTemplateOutlet } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, OnInit, Output, TemplateRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { Fetch } from 'client/app/services/fetch.service';

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

    @Input() items: any[] = [];
    @Input() typeName: string;

    @Output() onCreate = new EventEmitter();

    constructor(
        private fetch: Fetch
    ) { }

    ngOnInit() {
    }

    async drop(event: CdkDragDrop<any, any, any>) {
        if (event.previousIndex == event.currentIndex) return;

        // Update the array position after the data is updated in the backend
        moveItemInArray(this.items, event.previousIndex, event.currentIndex);

        this.items.forEach((item, index) => {
            item.order = index;
        });

        // Update the order of all of the items
        this.fetch.patch(`/api/db`, this.items.map(i => ({ id: i.id, data: { order: i.order } })));
    }

}
