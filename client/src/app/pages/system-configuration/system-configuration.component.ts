import { Component } from '@angular/core';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { CruiserSettings } from '../../../../../types/cruiser-settings';
import { TableModule } from 'primeng/table';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
    selector: 'app-system-configuration',
    templateUrl: './system-configuration.component.html',
    styleUrl: './system-configuration.component.scss',
    imports: [
        TableModule,
        MatInputModule,
        MenuDirective,
        MatIconModule,
        MatTabsModule
    ],
    standalone: true
})
export class SystemConfigurationComponent {

    settings: CruiserSettings;

    menu: MenuItem[] = [

    ];

    constructor(
        private readonly fetch: Fetch
    ) {

    }

    ngOnInit() {
        this.loadSettings();
    }

    async loadSettings() {
        this.settings = await this.fetch.get<CruiserSettings>('/api/system/settings');
    }
}
