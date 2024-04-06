import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChangeDetectorRef, Component, HostListener, QueryList, ViewChildren, ViewContainerRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Fetch, MenuDirective, TabulatorComponent, TooltipDirective } from '@dotglitch/ngx-common';
import Sortable from 'sortablejs';

import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';
import { StageSvgDiagramComponent } from 'client/app/components/stage-svg-diagram/stage-svg-diagram.component';
import { ReleasesComponent } from 'client/app/pages/releases/releases.component';
import { StagePopupComponent } from 'client/app/pages/stage-popup/stage-popup.component';

@Component({
    selector: 'app-grid-view',
    templateUrl: './grid-view.component.html',
    styleUrl: './grid-view.component.scss',
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
        JobInstanceIconComponent,
        StageSvgDiagramComponent
    ],
    standalone: true,
})
export class GridViewComponent {

    @ViewChildren("grid") gridRef: QueryList<any>;

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    sortableSectors: Sortable[] = [];

    constructor(
        public readonly parent: ReleasesComponent,
        private readonly viewContainer: ViewContainerRef,
        private readonly fetch: Fetch,
        public readonly changeDetector: ChangeDetectorRef
    ) { }

    ngAfterViewInit() {
        setTimeout(() => {
            this.gridRef.toArray().forEach(({ nativeElement }) => {
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
                        const pipeline = this.parent.pipelines?.find(p => p.id == id);

                        console.log(evt, pipeline);

                        if (!pipeline)
                            return;

                        if (group != pipeline.group || order != pipeline.order) {
                            const groupItems = this.parent.pipelineGroups.find(g => g.label == group)?.items;

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


                            this.fetch.patch(`/api/odata`, items.map(i => ({ id: i.id, data: { order: i.order } })));
                        }
                        else
                            return;

                        const oldIndex = this.parent.pipelines.findIndex(i => i.id == pipeline.id);
                        this.parent.pipelines.splice(oldIndex, 1, pipeline);

                        this.ngAfterViewInit();
                    }
                });
                const i = this.sortableSectors.push(s);

                (nativeElement as HTMLElement).dataset['sortable'] = i.toString();
            });
        }, 100)
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

    @HostListener("window:resize")
    onResize() {
        const el = this.viewContainer?.element?.nativeElement as HTMLElement;
        this.containerBounds = el.getBoundingClientRect();
    }
}
