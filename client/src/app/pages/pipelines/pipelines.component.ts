import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren, ViewContainerRef, Inject, Input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LazyLoaderService, MenuDirective, TabulatorComponent, TooltipDirective } from '@dotglitch/ngx-common';
import { JobDefinition, PipelineDefinition } from 'src/types/pipeline';
import Sortable from 'sortablejs';
import { orderSort } from '../../utils/utils';
import { DialogService, Fetch, MenuItem } from '@dotglitch/ngx-common';
import { StagePopupComponent } from 'src/app/pages/stage-popup/stage-popup.component';
import { JobInstanceIconComponent } from 'src/app/components/job-instance-icon/job-instance-icon.component';
import * as k8s from '@kubernetes/client-node';
import { JobInstance } from 'src/types/agent-task';
import { LiveSocketService } from 'src/app/services/live-socket.service';
import { StageSvgDiagramComponent } from 'src/app/components/stage-svg-diagram/stage-svg-diagram.component';

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
        JobInstanceIconComponent,
        StageSvgDiagramComponent
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



    cols = 4;

    private subscriptions = [
        this.liveSocket.subscribe(({ev, data}) => {
            this.ngOnInit()
        })
    ]

    constructor(
        private readonly viewContainer: ViewContainerRef,
        private readonly dialog: DialogService,
        private readonly lazyLoader: LazyLoaderService,
        private readonly fetch: Fetch,
        private readonly changeDetector: ChangeDetectorRef,
        private readonly liveSocket: LiveSocketService
    ) {
        // lazyLoader.registerComponent({
        //     id: "pipeline-editor",
        //     group: "dynamic",
        //     load: () => import('./editor/editor.component')
        // });
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

        const {
            pipelines,
            kubeJobs,
            jobs
        } = (await this.fetch.get<{
            pipelines: PipelineDefinition[],
            kubeJobs: k8s.V1Job[],
            jobs: JobInstance[]
        }>('/api/pipeline/'));

        const pipelineMap = {};
        pipelines.forEach(p => pipelineMap[p.id] = p);

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



    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    editPipeline(pipeline: Partial<PipelineDefinition> = {}) {
        location.hash = `#/Pipelines/${pipeline.id}`;
    }

    newPipeline(group: string) {
        location.hash = `#/Pipelines/new`;
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
