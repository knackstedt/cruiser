import { AsyncPipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MenuDirective, MenuItem } from '@dotglitch/ngx-common';
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


    userMenu: MenuItem[] = [
        { label: "User Profile", link: "" },
        { label: "Change Password", link: "" },
        { label: "About", link: "" },
        "separator",
        { label: "Log Out", link: "/api/oauth/gh/logout" },
    ]

    constructor(
        public readonly user: UserService
    ) { }

    ngOnInit() {

    }
}
