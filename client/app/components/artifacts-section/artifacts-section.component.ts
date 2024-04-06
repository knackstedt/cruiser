import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { JobDefinition } from 'types/pipeline';
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

    @Input() job: JobDefinition;

    @Output() valueChange = new EventEmitter();

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
        this.job.artifacts = this.job.artifacts ?? [];
    }

    addArtifact() {
        this.job.artifacts.push({
            id: `artifact:${ulid()}`,
            label: '',
            destination: '',
            source: '',
        })
    }

    getExtension(algorithm: string) {
        return this.compressionAlgorithms.find(c => c.name == algorithm)?.extension;
    }
}
