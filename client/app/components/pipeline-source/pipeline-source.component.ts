import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PipelineSource } from 'client/types/pipeline';

@Component({
    selector: 'app-pipeline-source',
    templateUrl: './pipeline-source.component.html',
    styleUrls: ['./pipeline-source.component.scss'],
    imports: [
        MatFormFieldModule,
        MatCheckboxModule,
        FormsModule
    ],
    standalone: true
})
export class PipelineSourceComponent implements OnInit {

    @Input() source: PipelineSource;

    constructor() { }

    ngOnInit() {
    }

}
