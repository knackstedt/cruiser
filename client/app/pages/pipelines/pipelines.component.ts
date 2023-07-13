import { Component, HostListener, OnInit, ViewContainerRef } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NgForOf, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DialogService } from 'client/app/services/dialog.service';
import { NgxLazyLoaderService } from '@dotglitch/ngx-lazy-loader';
import { Pipeline } from 'types/pipeline';
import { Fetch } from 'client/app/services/fetch.service';

@Component({
    selector: 'app-pipelines',
    templateUrl: './pipelines.component.html',
    styleUrls: ['./pipelines.component.scss'],
    imports: [
        NgForOf,
        NgIf,
        MatExpansionModule,
        MatButtonModule,
        MatTooltipModule,
        MatIconModule,
        DragDropModule,
    ],
    standalone: true
})
export class PipelinesComponent implements OnInit {

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    pipelineGroups = [
        { label: "default", items: [] },
    ]

    constructor(
        private viewContainer: ViewContainerRef,
        private dialog: DialogService,
        private lazyLoader: NgxLazyLoaderService,
        private fetch: Fetch
    ) {
        if (!lazyLoader.isComponentRegistered("pipeline-editor", "dynamic")) {
            lazyLoader.registerComponent({
                id: "pipeline-editor",
                group: "dynamic",
                load: () => import('../@editors/pipeline-editor/pipeline-editor.component')
            })
        }
    }

    async ngOnInit() {
        this.pipelineGroups = [
            { label: "default", items: [] },
        ];

        const pipelines: Pipeline[] = await this.fetch.get('/api/pipeline');

        pipelines.forEach(pipeline => {
            const group = pipeline.group;

            let g = this.pipelineGroups.find(g => g.label == group);
            if (!g) {
                g = { label: group, items: [] };
                this.pipelineGroups.push(g);
            }

            g.items.push(pipeline);
        });
    }

    createPipeline(pipeline: Partial<Pipeline>) {
        this.dialog.open("pipeline-editor", { group: "dynamic", inputs: { pipeline }, autoFocus: false })
    }

    drop(event: CdkDragDrop<any, any, any>) {
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        }
        else {
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex,
            );
        }
    }

    onScroll(el: HTMLDivElement) {

        this.viewportStart = el?.scrollTop || 0;
        this.viewportEnd = this.viewportStart + this.containerBounds.height;
    }

    @HostListener("window:resize")
    onResize() {
        const el = this.viewContainer?.element?.nativeElement as HTMLElement;
        this.containerBounds = el.getBoundingClientRect();
    }
}
