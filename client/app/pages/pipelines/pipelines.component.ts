import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren, ViewContainerRef, Inject } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LazyLoaderService, MenuDirective, TabulatorComponent, TooltipDirective } from '@dotglitch/ngx-common';
import { PipelineDefinition } from 'types/pipeline';
import Sortable from 'sortablejs';
import { orderSort } from '../../services/utils';
import { DialogService, Fetch, MenuItem } from '@dotglitch/ngx-common';
import { StagePopupComponent } from 'client/app/pages/pipelines/stage-popup/stage-popup.component';
import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';
import { PipelineHistoryComponent } from 'client/app/pages/pipelines/pipeline-history/pipeline-history.component';

@Component({
    selector: 'app-pipelines',
    templateUrl: './pipelines.component.html',
    styleUrls: ['./pipelines.component.scss'],
    imports: [
        TooltipDirective,
        MatExpansionModule,
        MatButtonModule,
        MatTooltipModule,
        MatIconModule,
        MatProgressBarModule,
        DragDropModule,
        MenuDirective,
        TabulatorComponent,
        StagePopupComponent,
        JobInstanceIconComponent
    ],
    standalone: true
})
export class PipelinesComponent implements OnInit {
    @ViewChildren("grid") gridRef: QueryList<any>;

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    pipelines: PipelineDefinition[];
    pipelineGroups: { label: string, items: PipelineDefinition[]}[] = [
        { label: "default", items: [] },
    ]

    sortableSectors: Sortable[] = [];

    readonly ctxMenu: MenuItem<PipelineDefinition>[] = [
        {
            label: "Edit",
            action: pipeline => this.editPipeline(pipeline)
        },
        {
            label: "Download JSON",
            action: async pipeline => {
                const link = document.createElement("a");
                link.download = pipeline.label.replace(/[^a-z0-9A-Z_\-$ ]/g, '') + '.json';
                link.href = `/api/pipeline/${pipeline.id}`;
                link.click();
                link.remove();
            }
        },
        {
            label: "Delete",
            action: async (pipeline) => {
                let res = await true;//this.dialog.confirmAction(`Are you sure you want to delete pipeline '${pipeline.label}'?`);
                if (!res) return;

                this.fetch.delete(`/api/odata/${pipeline.id}`);

                const el = (this.viewContainer.element.nativeElement as HTMLElement).querySelector(`[pipeline-id="${pipeline.id}"]`);
                el.classList.add("destroy-animation");

                setTimeout(() => {
                    const group = this.pipelineGroups.find(g => g.label == pipeline.group);
                    group.items.splice(group.items.findIndex(i => i.id == pipeline.id), 1);

                    this.changeDetector.detectChanges();
                }, 200);
            }
        },
        {
            label: "View History",
            linkTemplate: pipeline => `#/CommitGraph?pipeline=${pipeline.id}`
        },
        {
            label: "Compare",
            linkTemplate: pipeline => `#/Compare?pipeline=${pipeline.id}`
        },
        {
            label: "Changes",
            linkTemplate: pipeline => `#/Changes?pipeline=${pipeline.id}`
        },
        {
            label: "Deployment Map",
            linkTemplate: pipeline => `#/VSM?pipeline=${pipeline.id}`
        }
    ];

    cols = 4;

    constructor(
        private viewContainer: ViewContainerRef,
        private dialog: DialogService,
        private lazyLoader: LazyLoaderService,
        private fetch: Fetch,
        private changeDetector: ChangeDetectorRef
    ) {
        lazyLoader.registerComponent({
            id: "pipeline-editor",
            group: "dynamic",
            load: () => import('../@editors/pipeline-editor/pipeline-editor.component')
        });
        lazyLoader.registerComponent({
            id: "history",
            group: "dynamic",
            load: () => import('./pipeline-history/pipeline-history.component')
        });
    }

    async ngOnInit() {
        this.pipelineGroups = [
            { label: "default", items: [] },
        ];

        const pipelines = (await this.fetch.get('/api/odata/pipelines?$filter=isUserEditInstance ne true or isUserEditInstance eq null'))['value'];
        const pipelineMap = {};
        pipelines.forEach(p => pipelineMap[p.id] = p);


        const jobs = (await this.fetch.get(`/api/odata/jobs?$filter=latest eq true`))['value'];

        jobs.forEach(j => {
            const pipeline = pipelineMap[j.pipeline];
            const stage = pipeline?.stages.find(s => s.id == j.stage);

            if (stage) {
                stage['_latestJob'] = j;
            }
        });

        this.pipelines = pipelines;

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

        this.pipelineGroups.forEach(g => g.items.sort(orderSort));

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


                            this.fetch.patch(`/api/odata`, items.map(i => ({ id: i.id, data: { order: i.order }})));
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

    editPipeline(pipeline: Partial<PipelineDefinition> = {}) {
        this.dialog.open("pipeline-editor", 'dynamic', { inputs: { pipeline }, autoFocus: false })
            .then((pipeline: PipelineDefinition) => {
                console.log("res", pipeline)
                if (pipeline) {
                    const old = this.pipelines.find(p => p.id == pipeline.id);
                    if (old) {
                        // Clear the old props
                        Object.keys(old).forEach(k => old[k] = undefined);
                        // Update the new props
                        Object.keys(pipeline).forEach(k => old[k] = pipeline[k]);
                    }
                    else {
                        this.pipelines.push(pipeline);
                    }
                    this.ngAfterViewInit();
                }
            })
    }

    viewHistory(pipeline: PipelineDefinition) {
        this.dialog.open('history', 'dynamic', {
            width: "90vw",
            height: "90vh",
            inputs: {
                pipeline
            }
        })
    }

    async simplePatchPipeline(pipeline: PipelineDefinition, data: Partial<PipelineDefinition>) {
        const updated = await this.fetch.patch(`/api/odata/${pipeline.id}`, data);
        Object.keys(updated).forEach(key => {
            pipeline[key] = updated[key];
        });
        this.changeDetector.detectChanges();
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

    async triggerPipeline(targetPipeline: PipelineDefinition) {
        await this.fetch.get(`/api/pipeline/${targetPipeline.id}/start`)
            .then(({ pipeline }) => {
                Object.assign(targetPipeline, pipeline);
            });
    }

    async triggerPipelineWithOptions(pipeline: PipelineDefinition) {
        await this.fetch.get(`/api/pipeline/${pipeline.id}/start`);
        pipeline.stats = pipeline.stats ?? { runCount: 0, successCount: 0, failCount: 0, totalRuntime: 0 };
        pipeline.stats.runCount += 1;
    }

    pausePipeline(pipeline: PipelineDefinition) {
        this.simplePatchPipeline(pipeline, { state: "paused" });
    }

    resumePipeline(pipeline: PipelineDefinition) {
        this.simplePatchPipeline(pipeline, { state: "active" });
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
