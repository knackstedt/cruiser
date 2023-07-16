import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren, ViewContainerRef, Inject } from '@angular/core';
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
import { ThemedIconDirective } from 'client/app/services/theme.service';
import Sortable from 'sortablejs';
import { HeaderbarComponent } from 'client/app/components/headerbar/headerbar.component';


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
    @ViewChildren("grid") gridRef: QueryList<any>;

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    pipelines: Pipeline[];
    pipelineGroups: { label: string, items: Pipeline[]}[] = [
        { label: "default", items: [] },
    ]

    sortableSectors: Sortable[] = [];

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

    constructor(
        private viewContainer: ViewContainerRef,
        private dialog: DialogService,
        private lazyLoader: NgxLazyLoaderService,
        private fetch: Fetch,
        private changeDetector: ChangeDetectorRef
    ) {
        lazyLoader.registerComponent({
            id: "pipeline-editor",
            group: "dynamic",
            load: () => import('../@editors/pipeline-editor/pipeline-editor.component')
        });
    }

    async ngOnInit() {
        this.pipelineGroups = [
            { label: "default", items: [] },
        ];

        this.pipelines = await this.fetch.get('/api/db/pipeline');
        this.ngAfterViewInit();
    }

    ngAfterViewInit() {
        this.pipelineGroups.forEach(g => g.items.splice(0));

        this.pipelines?.forEach(pipeline => {
            const group = pipeline.group;

            let g = this.pipelineGroups.find(g => g.label == group);
            if (!g) {
                g = { label: group, items: [] };
                this.pipelineGroups.push(g);
            }

            g.items.push(pipeline);
        });

        this.pipelineGroups.forEach(g => g.items.sort((a, b) => {
            if (typeof a.order != 'number') return 1;
            if (typeof b.order != 'number') return -1;
            return a.order - b.order;
        }));

        this.changeDetector.detectChanges();


        setTimeout(() => {
            this.gridRef.toArray().forEach(({nativeElement}) => {
                if ((nativeElement as HTMLElement).dataset['sortable']) {
                    return;
                }

                const s = new Sortable(nativeElement, {
                    animation: 300,
                    easing: "cubic-bezier(0, 0.55, 0.45, 1)",
                    ghostClass: "sortable-ghost",
                    group: "pipelines",
                    filter(event, target, sortable) {
                        // Make buttons and links not draggable targets on the tile
                        return ['A', 'BUTTON', 'MAT-ICON', 'IMG', 'svg', 'path'].includes((event.target as HTMLElement).nodeName) ||
                            event.target['classList']?.contains("mat-mdc-button-touch-target") ||
                            event.target['classList']?.contains("new-placeholder");
                    },
                    forceFallback: true,
                    fallbackOffset: {
                        x: -200,
                        y: 0
                    },

                    onEnd: async (evt) => {
                        // TODO: handle updating entry after drag update

                        const group = evt.to.getAttribute('pipeline-group');
                        const id = evt.item.getAttribute('pipeline-id');
                        const order = evt.newIndex;
                        const pipeline = this.pipelines?.find(p => p.id == id);

                        console.log(evt, pipeline)

                        if (!pipeline)
                            return;

                        if (group != pipeline.group || order != pipeline.order) {
                            const groupItems = this.pipelineGroups.find(g => g.label == group)?.items;

                            const beforeItems = groupItems.slice(0, order).filter(i => i.id != pipeline.id);
                            const afterItems = groupItems.slice(order).filter(i => i.id != pipeline.id);

                            const items = [];
                            let pointer = 0;
                            beforeItems.forEach(i => {
                                i.order = pointer++;
                                items.push(i);
                            });

                            if (group != pipeline.group)
                                pipeline.group = group;

                            pipeline.order = pointer++;
                            items.push(pipeline);

                            afterItems.forEach(i => {
                                i.order = pointer++;
                                items.push(i);
                            });


                            this.fetch.patch(`/api/db`, items.map(i => ({ id: i.id, data: { order: i.order }})));
                        }
                        else
                            return;

                        const oldIndex = this.pipelines.findIndex(i => i.id == pipeline.id);
                        this.pipelines.splice(oldIndex, 1, pipeline);

                        this.ngAfterViewInit();
                    }
                });
                const i = this.sortableSectors.push(s);

                (nativeElement as HTMLElement).dataset['sortable'] = i.toString();
            })
        }, 100)
    }

    createPipeline(pipeline: Partial<Pipeline> = {}) {
        this.dialog.open("pipeline-editor", { group: "dynamic", inputs: { pipeline }, autoFocus: false })
            .then((pipeline: Pipeline) => {
                console.log("res", pipeline)
            if (pipeline) {
                this.pipelines.push(pipeline)
                this.ngAfterViewInit();
            }
        })
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

    triggerPipeline(pipeline: Pipeline) {
        this.fetch.get(`/api/pipeline/${pipeline.id}/start`);
    }

    triggerPipelineWithOptions(pipeline: Pipeline) {
        this.fetch.get(`/api/pipeline/${pipeline.id}/start`);
    }

    pausePipeline(pipeline: Pipeline) {
        this.fetch.get(`/api/pipeline/${pipeline.id}/pause`);
    }

    resumePipeline(pipeline: Pipeline) {
        this.fetch.get(`/api/pipeline/${pipeline.id}/resume`).then(p => {

        });
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
