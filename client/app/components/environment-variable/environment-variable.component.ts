import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { EnvironmentVariable } from 'client/types/environment';

@Component({
    selector: 'app-environment-variable',
    templateUrl: './environment-variable.component.html',
    styleUrls: ['./environment-variable.component.scss'],
    imports: [
        MatFormFieldModule,
        FormsModule
    ],
    standalone: true
})
export class EnvironmentVariableComponent implements OnInit {

    @Input() variable: EnvironmentVariable;

    constructor() { }

    ngOnInit() {
    }

}
