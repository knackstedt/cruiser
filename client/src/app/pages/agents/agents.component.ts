import { NgForOf, NgIf } from '@angular/common';
import { Component, HostListener, OnInit, ViewContainerRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { LazyLoaderService } from '@dotglitch/ngx-common';
import { MatTabsModule } from '@angular/material/tabs';
import { DialogService } from '@dotglitch/ngx-common';

@Component({
    selector: 'app-agents',
    templateUrl: './agents.component.html',
    styleUrls: ['./agents.component.scss'],
    imports: [
        NgIf,
        NgForOf,
        MatExpansionModule,
        MatButtonModule,
        MatTooltipModule,
        MatIconModule,
        MatTabsModule,
        DragDropModule
    ],
    standalone: true
})
export class AgentsComponent implements OnInit {

    viewportStart = 0;
    viewportEnd = 500;
    containerBounds: DOMRect;

    agentGroups = [
        { label: "default", items: [] },
        { label: "Windows", items: [] },
        { label: "Linux", items: [] },
    ]

    runningElasticAgents = []
    elasticAgentConfigurations = []

    constructor(
        private viewContainer: ViewContainerRef,
        private dialog: DialogService,
        private lazyLoader: LazyLoaderService
    ) {
        if (!lazyLoader.isComponentRegistered("agent-editor", "dynamic")) {
            lazyLoader.registerComponent({
                id: "agent-editor",
                group: "dynamic",
                load: () => import('./agent-editor/agent-editor.component')
            });
        }
    }

    ngOnInit() {
    }

    createPipeline(pipeline: Partial<any>) {
        this.dialog.open("agent-editor", 'dynamic', { inputs: { pipeline }, autoFocus: false });
    }

    drop(event: CdkDragDrop<any, any, any>) {
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        } else {
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
