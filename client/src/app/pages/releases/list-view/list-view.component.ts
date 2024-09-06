import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuDirective, TooltipDirective } from '@dotglitch/ngx-common';
import { JobInstanceIconComponent } from 'src/app/components/job-instance-icon/job-instance-icon.component';
import { ReleasesComponent } from 'src/app/pages/releases/releases.component';
import { StagePopupComponent } from 'src/app/pages/stage-popup/stage-popup.component';
import { NgScrollbarModule } from 'ngx-scrollbar';

@Component({
    selector: 'app-list-view',
    templateUrl: './list-view.component.html',
    styleUrl: './list-view.component.scss',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTooltipModule,
        MatProgressBarModule,
        NgScrollbarModule,
        MenuDirective,
        TooltipDirective,
        FormsModule,
        ScrollingModule,
        JobInstanceIconComponent,
        StagePopupComponent,
        MenuDirective
    ],
    standalone: true
})
export class ListViewComponent {
    constructor(
        public readonly parent: ReleasesComponent,
        public readonly changeDetector: ChangeDetectorRef
    ) { }
}
