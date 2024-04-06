import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { AddUserComponent } from 'src/app/pages/users/add-user/add-user.component';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { CruiserUserProfile, CruiserUserRole } from 'src/types/cruiser-types';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.scss'],
    imports: [
        TableModule,
        MatButtonModule,
        MatIconModule,
        MenuDirective,
        MatInputModule
    ],
    standalone: true
})
export class UsersComponent {

    users: CruiserUserProfile[];

    menu: MenuItem<CruiserUserProfile>[] = [
        { label: "Remove", isVisible: user => true, action: user => this.removeUser(user) },
        {
            label: "Roles",
            children: [
                {
                    icon: "add",
                    label: "Administrator",
                    isVisible: user => !user.roles.includes('administrator'),
                    action: user => this.grantUserRole(user, 'administrator')
                },
                {
                    icon: "remove",
                    label: "Administrator",
                    isVisible: user => user.roles.includes('administrator'),
                    action: user => this.revokeUserRole(user, 'administrator')
                },
                {
                    icon: "add",
                    label: "Manager",
                    isVisible: user => !user.roles.includes('manager'),
                    action: user => this.grantUserRole(user, 'manager')
                },
                {
                    icon: "remove",
                    label: "Manager",
                    isVisible: user => user.roles.includes('manager'),
                    action: user => this.revokeUserRole(user, 'manager')
                },
                {
                    icon: "add",
                    label: "User",
                    isVisible: user => !user.roles.includes('user'),
                    action: user => this.grantUserRole(user, 'user')
                },
                {
                    icon: "remove",
                    label: "User",
                    isVisible: user => user.roles.includes('user'),
                    action: user => this.revokeUserRole(user, 'user')
                }
            ]
        }
    ]

    constructor(
        private readonly dialog: MatDialog,
        private readonly fetch: Fetch
    ) { }

    async ngOnInit() {
        this.users = (await this.fetch.get('/api/odata/users'))['value']
    }

    addUser() {
        firstValueFrom(this.dialog.open(AddUserComponent).afterClosed())
            .then(r => this.ngOnInit())
    }

    grantUserRole(user: CruiserUserProfile, role: CruiserUserRole) {
        this.fetch.post(`/api/user/grant-role/${user.id}`, {
            role
        })
            .then(res => {
                this.ngOnInit()
            });
    }

    revokeUserRole(user: CruiserUserProfile, role: CruiserUserRole) {
        this.fetch.post(`/api/user/revoke-role/${user.id}`, {
            role
        })
            .then(res => {
                this.ngOnInit()
            });
    }

    removeUser(user: CruiserUserProfile) {
        this.fetch.delete(`/api/user/${user.id}`)
            .then(res => {
                this.ngOnInit()
            });
    }
}
