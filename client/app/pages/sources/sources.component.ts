import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { EditSourceComponent } from 'client/app/pages/sources/edit-source/edit-source.component';
import { TableModule } from 'primeng/table';
import { SourceConfiguration } from 'types/pipeline';

@Component({
    selector: 'app-sources',
    templateUrl: './sources.component.html',
    styleUrls: ['./sources.component.scss'],
    imports: [
        TableModule,
        MenuDirective,
        MatIconModule,
        MatButtonModule,
        MatInputModule
    ],
    standalone: true
})
export class SourcesComponent {

    sources: SourceConfiguration[] = [];

    menu: MenuItem<SourceConfiguration>[] = [
        { label: "Remove" },
    ]

    constructor(
        private readonly fetch: Fetch,
        private readonly dialog: MatDialog
    ) { }

    async ngOnInit() {
        this.sources = (await this.fetch.get(`/api/sources`));
    }

    editSource(source = {}) {
        this.dialog.open(EditSourceComponent, { data: source })
    }
}
