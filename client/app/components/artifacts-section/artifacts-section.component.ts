import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
        FormsModule
    ],
    standalone: true
})
export class ArtifactsSectionComponent implements OnInit {

    @Input() job: JobDefinition;

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
}
