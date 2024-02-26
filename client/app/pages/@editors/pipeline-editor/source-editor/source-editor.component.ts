import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { SourceConfiguration } from 'types/pipeline';

@Component({
    selector: 'app-source-editor',
    templateUrl: './source-editor.component.html',
    styleUrls: ['./source-editor.component.scss'],
    imports: [
        MatInputModule,
        MatCheckboxModule,
        FormsModule
    ],
    standalone: true
})
export class PipelineSourceComponent implements OnInit {

    @Input() source: SourceConfiguration;

    constructor() { }

    ngOnInit() {
    }

}
