import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-lockout',
    templateUrl: './lockout.component.html',
    styleUrls: ['./lockout.component.scss'],
    imports: [
        MatButtonModule
    ],
    standalone: true
})
export class LockoutComponent  {

    constructor(
        public readonly user: UserService
    ) { }
}
