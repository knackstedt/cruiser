import { Component, ElementRef, HostListener, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
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
import { ContextMenuItem, NgxAppMenuDirective, NgxContextMenuDirective } from '@dotglitch/ngx-ctx-menu';
import { CompactType, DisplayGrid, GridType, GridsterComponent, GridsterConfig, GridsterItem, GridsterItemComponentInterface, GridsterModule } from 'angular-gridster2';
import { ThemedIconDirective } from 'client/app/services/theme.service';
import Sortable from 'sortablejs';
import { HeaderbarComponent } from 'client/app/components/headerbar/headerbar.component';

// import Sortable from 'sortablejs/modular/sortable.core.esm.js';
// import Sortable from 'sortablejs/modular/sortable.complete.esm.js';



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
        NgxAppMenuDirective,
        NgxContextMenuDirective,
        ThemedIconDirective,
        HeaderbarComponent
    ],
    standalone: true
})
export class PipelinesComponent implements OnInit {
    @ViewChild("grid") gridRef: ElementRef;

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    pipelineGroups: { label: string, items: Pipeline[]}[] = [
        { label: "default", items: [] },
    ]

    readonly ctxMenu: ContextMenuItem<Pipeline>[] = [
        {
            label: "Edit"
        },
        {
            label: "Copy"
        },
        {
            label: "Delete"
        },
        {
            label: "View History"
        },
        {
            label: "Compare"
        },
        {
            label: "Changes"
        },
        {
            label: "Deployment Map"
        }
    ];

    cols = 4;

    // options: GridsterConfig = {
    //     gridType: GridType.Fixed,
    //     displayGrid: DisplayGrid.None,
    //     swap: true,
    //     draggable: {
    //         delayStart: 0,
    //         enabled: true,
    //         ignoreContentClass: 'gridster-item-content',
    //         ignoreContent: false,
    //         dragHandleClass: 'drag-handler',
    //         stop: this.eventStop.bind(this),
    //         // start: DragComponent.eventStart,
    //         dropOverItems: false,
    //         // dropOverItemsCallback: DragComponent.overlapEvent
    //     },
    //     compactType: CompactType.CompactUp,
    //     disableScrollHorizontal: true,
    //     disableScrollVertical: false,
    //     // maxRows: 1,
    //     margin: 16,
    //     fixedColWidth: 268,
    //     fixedRowHeight: 230,
    //     minCols: 6,
    //     maxCols: 6,
    // };
    // eventStop(
    //     item: GridsterItem,
    //     itemComponent: GridsterItemComponentInterface,
    //     event: MouseEvent
    // ): void {
    //     this.grid.grid.sort((a, b) => !a ? -1 : !b ? 1 : 0)
    // }

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

    ngAfterViewInit() {
        new Sortable(this.gridRef.nativeElement, {
            animation: 300,
            easing: "cubic-bezier(1, 0, 0, 1)", // Easing for animation. Defaults to null. See https://easings.net/ for examples.
            ghostClass: "sortable-ghost",  // Class name for the drop placeholder
            forceFallback: true,
            fallbackOffset: {
                x: -200,
                y: 0
            },
            // Element dragging ended
            onEnd: function (/**Event*/evt) {
                var itemEl = evt.item;  // dragged HTMLElement
                evt.to;    // target list
                evt.from;  // previous list
                evt.oldIndex;  // element's old index within old parent
                evt.newIndex;  // element's new index within new parent
                evt.oldDraggableIndex; // element's old index within old parent, only counting draggable elements
                evt.newDraggableIndex; // element's new index within new parent, only counting draggable elements
                evt.clone; // the clone element
                evt.pullMode;  // when item is in another sortable: `"clone"` if cloning, `true` if moving
            }
        })
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
        // this.viewportStart = el?.scrollTop || 0;
        // this.viewportEnd = this.viewportStart + this.containerBounds.height;
    }

    @HostListener("window:resize")
    onResize() {
        const el = this.viewContainer?.element?.nativeElement as HTMLElement;
        this.containerBounds = el.getBoundingClientRect();
    }
}
