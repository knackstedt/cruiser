import { Component, Input, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-headerbar',
    templateUrl: './headerbar.component.html',
    styleUrls: ['./headerbar.component.scss'],
    imports: [
        MatIconModule
    ],
    standalone: true
})
export class HeaderbarComponent implements OnInit {

    @Input() label: string;

    constructor() { }

    ngOnInit() {

    }
}
