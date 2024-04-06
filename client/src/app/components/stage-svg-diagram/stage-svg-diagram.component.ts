import { Component, Input, OnInit } from '@angular/core';
import { PipelineDefinition, StageDefinition } from 'types/pipeline';
import dagre from '@dagrejs/dagre';
import { JobInstanceIconComponent } from 'client/app/components/job-instance-icon/job-instance-icon.component';
import { Fetch } from '@dotglitch/ngx-common';
import { JobInstance } from 'types/agent-task';

const NODE_HEIGHT = 20;
const NODE_WIDTH = 40;

@Component({
    selector: 'app-stage-svg-diagram',
    templateUrl: './stage-svg-diagram.component.html',
    styleUrls: ['./stage-svg-diagram.component.scss'],
    imports: [
        JobInstanceIconComponent
    ],
    standalone: true
})
export class StageSvgDiagramComponent {

    @Input() pipeline: PipelineDefinition;

    stages: (StageDefinition & { position: {x,y}; })[] = []

    constructor(
        private readonly fetch: Fetch
    ) { }

    async ngOnInit() {
        const { value: instances } = await this.fetch.get<any>(`/api/odata/pipeline_instance?$filter=spec.id eq '${this.pipeline.id}'&$orderby=id desc`);
        if (!instances[0]) return; // No runs
        const { value: jobs } = await this.fetch.get<{ value: JobInstance[] }>(`/api/odata/job_instance?$filter=pipeline_instance eq '${instances[0].id}'`);

        jobs.forEach(j => {
            const stage = this.pipeline?.stages.find(s => s.id == j.stage);

            if (stage) {
                stage['_latestJob'] = j;
            }
        });

        this.renderGraph();
    }

    renderGraph() {
        const dagreGraph = new dagre.graphlib.Graph();

        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'LR' });

        const nodes = [];
        const edges = [];

        this.pipeline.stages.forEach(stage => {
            for (const precedingStageId of (stage.stageTrigger ?? [])) {
                edges.push({
                    source: precedingStageId.split(':')[1],
                    target: stage.id.split(':')[1],
                    id: precedingStageId.split(':')[1] + "_" + stage.id.split(':')[1],
                });
            }

            nodes.push({
                ...stage,
                id: stage.id.split(':')[1],
                position: {
                    x: 0,
                    y: 0
                }
            });
        });

        nodes.forEach(node => dagreGraph.setNode(node.id, { height: NODE_HEIGHT, width: NODE_WIDTH + 1 }));
        edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target));

        dagre.layout(dagreGraph);


        this.stages = (nodes as any[]).map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);

            const newX = nodeWithPosition.x - NODE_WIDTH / 2;
            const newY = nodeWithPosition.y - NODE_HEIGHT / 2;

            // Offset the entire grid so we don't need to pan the view initially.
            node.position = {
                x: newX / 2,
                y: newY / 3,
            };

            return node;
        });
    }
}
