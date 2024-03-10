import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Fetch } from '@dotglitch/ngx-common';
import { AddUserComponent } from 'client/app/pages/users/add-user/add-user.component';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.scss'],
    imports: [
        TableModule,
        MatButtonModule
    ],
    standalone: true
})
export class UsersComponent {

    users: any[];

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
}
