import { AsyncPipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from 'client/app/services/user.service';

@Component({
    selector: 'app-headerbar',
    templateUrl: './headerbar.component.html',
    styleUrls: ['./headerbar.component.scss'],
    imports: [
        MatIconModule,
        AsyncPipe
    ],
    standalone: true
})
export class HeaderbarComponent implements OnInit {

    @Input() label: string;

    constructor(
        public readonly user: UserService
    ) { }

    ngOnInit() {

    }
}
