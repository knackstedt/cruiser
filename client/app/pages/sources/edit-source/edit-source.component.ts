import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Fetch } from '@dotglitch/ngx-common';
import { SourceConfiguration } from 'types/pipeline';

@Component({
    selector: 'app-edit-source',
    templateUrl: './edit-source.component.html',
    styleUrls: ['./edit-source.component.scss'],
    imports: [
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatCheckboxModule,
        FormsModule
    ],
    standalone: true
})
export class EditSourceComponent {

    @Input() source: SourceConfiguration = {} as any;
    // @Input() type: "github" | "git";

    constructor(
        private readonly fetch: Fetch
    ) { }

    ngOnInit() {

    }

    save() {

    }
}
