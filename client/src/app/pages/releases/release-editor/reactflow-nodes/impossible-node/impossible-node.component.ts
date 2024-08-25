import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobDefinition } from 'src/types/pipeline';

@Component({
    selector: 'app-impossible-node',
    templateUrl: './impossible-node.component.html',
    styleUrls: ['./impossible-node.component.scss'],
    imports: [
        MatTooltipModule,
        MatIconModule
    ],
    standalone: true
})
export class ImpossibleNodeComponent {
    @Input('data') set data({ job }) {
        this.job = job;
    }

    job: JobDefinition;
}
