import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { EnvironmentVariable } from 'client/types/environment';

@Component({
    selector: 'app-environment-variable',
    templateUrl: './environment-variable.component.html',
    styleUrls: ['./environment-variable.component.scss'],
    imports: [
        NgIf,
        FormsModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
    ],
    standalone: true
})
export class EnvironmentVariableComponent implements OnInit {

    @Input() editing = false;

    @Input() secret = false;
    @Input() variable: EnvironmentVariable;

    @Output() createVariable = new EventEmitter<EnvironmentVariable>();

    validLabel = true;

    constructor() { }

    ngOnInit() {
        this.editing = !(this.variable?.key?.length > 1);
    }

    validateLabel(text: string) {
        this.validLabel = /^[A-Za-z0-9\-_]+$/.test(text);
    }
}
