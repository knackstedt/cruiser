import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { Fetch } from '@dotglitch/ngx-common';

@Component({
    selector: 'app-add-user',
    templateUrl: './add-user.component.html',
    styleUrls: ['./add-user.component.scss'],
    imports: [
        MatInputModule,
        FormsModule,
        MatButtonModule
    ],
    standalone: true
})
export class AddUserComponent {

    userId = '';

    constructor(
        private readonly fetch: Fetch,
        private readonly dialogRef: MatDialogRef<any>
    ) { }

    addUser() {
        this.fetch.post(`/api/user/add`, {
            userId: this.userId
        })
        .then(res => this.dialogRef.close(res));
    }
}
