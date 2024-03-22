import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Pages } from '../../component.registry';
import { Fetch, MenuDirective, MenuItem, NavigationService, ThemeService } from '@dotglitch/ngx-common';
import pack from '../../../../package.json';

@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.scss'],
    imports: [
        MenuDirective,
        MatTooltipModule,
        MatIconModule,
        AsyncPipe
    ],
    standalone: true
})
export class NavMenuComponent {

    readonly pages: any[] =
        Pages
        .filter(c => !c['hidden'])
        .filter(c => c['isVisible'] ? c['isVisible']() : true)
        .sort((a, b) => (a['order'] || 0) - (b['order'] || 0))
        .map(i => {

            return {
                label: i.id,
                link: '#/' + i.id,
                linkTarget: "_self" as "_self",
                ...i
            }
        })

    public readonly matIconRx = /[\/\.]/i;

    @Input() isMobile = false;

    collapsed = false;
    showAdvancedMenu = true;

    readonly profileLinks: MenuItem[] = [
        {
            label: "Appearance",
            children: [
                // {
                //     label: "Browser Theme",
                //     action: () => {

                //     }
                // },
                // "separator",
                {
                    // label: "Light",
                    labelTemplate: () => `${this.theme.value == "light" ? '⏺' : '\u00A0\u00A0\u00A0'} Light`,
                    action: () => this.theme.setTheme("light")
                },
                {
                    // label: "Dark",
                    labelTemplate: () => `${this.theme.value == "dark" ? '⏺' : '\u00A0\u00A0\u00A0\u00A0'} Dark`,
                    action: () => this.theme.setTheme("dark")
                },
            ]
        },
        {
            label: `Client Version: ${pack.version}`
        },
        {
            labelTemplate: () => `Server Version: ${this.serverVersion}`
        }
        // "separator",
        // { label: "Log out", link: "/api/logout?ngsw-bypass=true" }
    ]

    serverVersion = '';
    interval;

    constructor(
        public  readonly sanitizer: DomSanitizer,
        public  readonly navigator: NavigationService,
        private readonly theme: ThemeService,
        private readonly fetch: Fetch
    ) {

        fetch.get<any>(`/api/version`).then(v => this.serverVersion = v.version);
        this.interval = setInterval(() => {
            fetch.get<any>(`/api/version`).then(v => this.serverVersion = v.version);
        }, 60*60*1000) // Check hourly for a new backend version
    }

    ngOnDestroy() {
        clearInterval(this.interval);
    }
}
