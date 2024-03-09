import { Component, Input, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { JobInstance } from 'server/src/types/agent-task';

@Component({
    selector: 'app-job-instance-icon',
    templateUrl: './job-instance-icon.component.html',
    styleUrls: ['./job-instance-icon.component.scss'],
    imports: [
        MatIconModule
    ],
    standalone: true
})
export class JobInstanceIconComponent {

    @Input() jobInstance: JobInstance

}
