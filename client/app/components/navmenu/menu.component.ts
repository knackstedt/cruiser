import { NgForOf, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { BaseCtx, ContextMenuItem, NgxAppMenuDirective } from '@dotglitch/ngx-ctx-menu';
import { DomSanitizer } from '@angular/platform-browser';
import { LogoComponent } from 'client/app/components/logo/logo.component';
import { Pages } from 'client/app/component.registry';
import { ThemeService } from '@dotglitch/ngx-common';


@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.scss'],
    imports: [
        NgForOf,
        NgIf,
        NgxAppMenuDirective,
        MatTooltipModule,
        MatIconModule,
        LogoComponent
    ],
    standalone: true
})
export class NavMenuComponent {

    readonly pages: BaseCtx[] = [
        ...Pages
        .filter(c => !c['hidden'])
        .sort((a, b) => (a['order'] || 0) - (b['order'] || 0))
        .map(i => {

            return {
                label: i.id,
                link: '#/' + i.id,
                linkTarget: "_self" as "_self",
                ...i
            }
        })
    ]

    public readonly matIconRx = /[\/\.]/i;

    @Input() isMobile = false;

    collapsed = false;
    showAdvancedMenu = true;

    readonly profileLinks: ContextMenuItem[] = [
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
                }
            ]
        },
        // "separator",
        // { label: "Log out", link: "/api/logout?ngsw-bypass=true" }
    ]

    constructor(
        public readonly sanitizer: DomSanitizer,
        private readonly theme: ThemeService
    ) {

    }
}
