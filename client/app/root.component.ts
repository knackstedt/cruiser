import { Component, HostListener, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { MenuItem } from '@dotglitch/ngx-common';
import { NgIf } from '@angular/common';
import { NavMenuComponent } from './components/navmenu/menu.component';
import { Fetch, LazyLoaderComponent, KeyboardService, NavigationService } from '@dotglitch/ngx-common';

const desktopWidth = 1126;

@Component({
    selector: 'app-root',
    templateUrl: './root.component.html',
    styleUrls: ['./root.component.scss'],
    imports: [
        NgIf,
        NavMenuComponent,
        LazyLoaderComponent
    ],
    standalone: true
})
export class RootComponent {
    @ViewChild("drawer") drawer: MatDrawer;

    theme = 'dark';
    isMobile = false;

    readonly mainCtxItems: MenuItem<any>[] = [
        {
            label: "Appearance",
            children: [
                {
                    labelTemplate: () => `${this.theme == "light" ? '⏺' : '\u00A0\u00A0\u00A0'} Light`,
                    action: () => {
                        document.body.classList.remove("dark");
                        document.body.classList.add("light");
                    }
                },
                {
                    labelTemplate: () => `${this.theme == "dark" ? '⏺' : '\u00A0\u00A0\u00A0\u00A0'} Dark`,
                    action: () => {
                        document.body.classList.remove("dark");
                        document.body.classList.add("light");
                    }
                }
            ]
        }
    ];

    constructor(
        private fetch: Fetch,
        private keyboard: KeyboardService,
        public navigator: NavigationService,
        private dialog: MatDialog
    ) {
        this.onResize();
    }

    openInfo() {
    }


    @HostListener("window:resize", ["$event"])
    onResize() {
        this.isMobile = (window.innerHeight / window.innerWidth > 1.5) || window.innerWidth < 900;
        document.body.classList.remove("mobile");
        document.body.classList.remove("desktop");

        this.isMobile && document.body.classList.add("mobile");
        !this.isMobile && document.body.classList.add("desktop");
    }
}
