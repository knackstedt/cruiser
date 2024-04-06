import { Component, HostListener, ViewChild, isDevMode } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { CommandPaletteService, MenuItem, ThemeService } from '@dotglitch/ngx-common';
import { NavMenuComponent } from './components/navmenu/menu.component';
import { Fetch, LazyLoaderComponent, KeyboardService, NavigationService } from '@dotglitch/ngx-common';
import { UserService } from 'client/app/services/user.service';
import { LoginComponent } from 'client/app/pages/login/login.component';
import { HeaderbarComponent } from 'client/app/components/headerbar/headerbar.component';
import { LazyProgressDistractorComponent } from 'client/app/components/@framework/lazy-progress-distractor/lazy-progress-distractor.component';
import { LockoutComponent } from 'client/app/pages/lockout/lockout.component';

const desktopWidth = 1126;

@Component({
    selector: 'app-root',
    templateUrl: './root.component.html',
    styleUrls: ['./root.component.scss'],
    imports: [
        NavMenuComponent,
        LazyLoaderComponent,
        LoginComponent,
        LockoutComponent,
        HeaderbarComponent,
        LazyProgressDistractorComponent
    ],
    standalone: true
})
export class RootComponent {
    @ViewChild("drawer") drawer: MatDrawer;

    // Should we use a mobile layout
    isMobile = false;

    // Is the user successfully logged in
    isAuthenticated = false;

    // Is the user locked out (they have no access granted)
    isLockedOut = false;

    isLoggingIn = true;
    renderPageDistractor = true;

    readonly mainCtxItems: MenuItem<any>[] = [
        {
            label: "Appearance",
            children: [
                {
                    labelTemplate: () => `${this.theme.value == "light" ? '⏺' : '\u00A0\u00A0\u00A0'} Light`,
                    action: () => {
                        document.body.classList.remove("dark");
                        document.body.classList.add("light");
                    }
                },
                {
                    labelTemplate: () => `${this.theme.value == "dark" ? '⏺' : '\u00A0\u00A0\u00A0\u00A0'} Dark`,
                    action: () => {
                        document.body.classList.remove("dark");
                        document.body.classList.add("light");
                    }
                }
            ]
        }
    ];

    constructor(
        private readonly fetch: Fetch,
        private readonly keyboard: KeyboardService,
        public  readonly navigator: NavigationService,
        private readonly dialog: MatDialog,
        public  readonly commandPalette: CommandPaletteService,
        private readonly theme: ThemeService,
        public  readonly user: UserService
    ) {
        window['root'] = this;
        this.onResize();

        commandPalette.initialize({
            keybind: "ctrl+p"
        });
        commandPalette.attachElementCommands([
            isDevMode() ? {
                label: "Debug", shortcutKey: "pause", action: () => {
                    debugger;
                }
            } : { visibleInList: false },
            { label: "Logout", action: () => this.user.logout() },
            { label: "Theme: Dark", action: () => this.theme.setTheme('dark') },
            { label: "Theme: Light", action: () => this.theme.setTheme('light') },
            ...(location.host != "cruiser.dev" ? [
                {
                    label: "Debug: View distractor",
                    action: () => {
                        this.dialog.open(LazyProgressDistractorComponent, {
                            width: '640px',
                            height: "480px"
                        });
                    }
                }
        ] : []),
        ])
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
