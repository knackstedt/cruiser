import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { getPriorStages } from 'src/app/utils/utils';
import { OutputArtifact, JobDefinition, PipelineDefinition, StageDefinition } from 'src/types/pipeline';
import { ulid } from 'ulidx';

@Component({
    selector: 'app-artifacts-section',
    templateUrl: './artifacts-section.component.html',
    styleUrls: ['./artifacts-section.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        FormsModule
    ],
    standalone: true
})
export class ArtifactsSectionComponent implements OnInit {
    @Input() kind: "input" | "output" = "output";

    @Input() pipeline: PipelineDefinition;
    @Input() stage: StageDefinition;
    @Input() job: JobDefinition;

    @Output() valueChange = new EventEmitter();

    priorStages: StageDefinition[] = [];
    availableArtifacts: { stage: StageDefinition, artifacts: OutputArtifact[]}[] = [];

    readonly compressionAlgorithms = [
        { name: "lrzip", extension: ".tar.lrz" },
        { name: "gzip", extension: ".tar.gz" },
        { name: "zip", extension: ".zip" },
        { name: "zstd", extension: ".zstd" },
        { name: "zstd_max", extension: ".zstd" },
        { name: "bzip", extension: ".tar.bz" },
        { name: "plzip", extension: ".zip" },
        { name: "plzip_max", extension: ".zip" },
        { name: "xz", extension: ".tar.xz" },
        { name: "xz_max", extension: ".tar.xz" },
    ]

    constructor() { }

    ngOnInit() {
        if (!this.job) return;
        this.job.inputArtifacts = this.job.inputArtifacts ?? [];
        this.job.outputArtifacts = this.job.outputArtifacts ?? [];
        this.availableArtifacts = [];

        const priorStages = getPriorStages(this.pipeline, this.stage);

        priorStages.forEach(stage => {
            const artifacts = stage.jobs.flatMap(j => j.outputArtifacts);
            this.availableArtifacts.push({
                stage,
                artifacts
            });
        })
    }

    addInputArtifact() {
        this.job.inputArtifacts.push({
            id: ulid(),
            label: '',
            destination: '',
            job: '',
            sourceArtifact: ''
        })
    }

    addOutputArtifact() {
        this.job.outputArtifacts.push({
            id: ulid(),
            label: '',
            destination: '',
            source: ''
        })
    }

    getExtension(algorithm: string) {
        return this.compressionAlgorithms.find(c => c.name == algorithm)?.extension;
    }
}
