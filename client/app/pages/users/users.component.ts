import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { AddUserComponent } from 'client/app/pages/users/add-user/add-user.component';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { CruiserUserProfile, CruiserUserRole } from 'server/src/types';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.scss'],
    imports: [
        TableModule,
        MatButtonModule,
        MatIconModule,
        MenuDirective
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
                { label: "Grant Administrator role", isVisible: user => true, action: user => this.grantUserRole(user, 'administrator') },
                { label: "Grant Manager role", isVisible: user => true, action: user => this.grantUserRole(user, 'manager') }
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
                user.roles.push(role);
            });
    }

    removeUser(user: CruiserUserProfile) {

    }
}
