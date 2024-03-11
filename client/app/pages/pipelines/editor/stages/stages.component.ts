import { Component, Input } from '@angular/core';
import { PipelineDefinition } from 'types/pipeline';

@Component({
    selector: 'app-stages',
    standalone: true,
    imports: [

    ],
    templateUrl: './stages.component.html',
    styleUrl: './stages.component.scss'
})
export class StagesComponent {
    @Input() pipeline: PipelineDefinition;

}
