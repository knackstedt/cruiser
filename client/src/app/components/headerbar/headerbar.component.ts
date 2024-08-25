import { AsyncPipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MenuDirective, MenuItem, ThemeService } from '@dotglitch/ngx-common';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-headerbar',
    templateUrl: './headerbar.component.html',
    styleUrls: ['./headerbar.component.scss'],
    imports: [
        MatIconModule,
        AsyncPipe,
        MenuDirective
    ],
    standalone: true
})
export class HeaderbarComponent implements OnInit {


    readonly userMenu: MenuItem[] = [
        {
            label: "Appearance",
            children: [
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
        { label: "User Settings", link: "#/User/Settings" },
        { label: "About", link: "#/About" },
        "separator",
        { label: "Log Out", link: "/api/oauth/gh/logout" },
    ]

    constructor(
        public readonly user: UserService,
        private readonly theme: ThemeService
    ) { }

    ngOnInit() {

    }
}
