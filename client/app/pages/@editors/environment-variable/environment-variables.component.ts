import { NgForOf, NgIf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EnvironmentVariableComponent } from './environment-variable/environment-variable.component';
import { EnvironmentVariable } from 'types/environment';

@Component({
    selector: 'app-environment',
    templateUrl: './environment-variable.component.html',
    styleUrls: ['./environment-variable.component.scss'],
    imports: [
        NgForOf,
        MatIconModule,
        MatButtonModule,
        EnvironmentVariableComponent
    ],
    standalone: true
})
export class EditEnvironmentVariablesComponent implements OnInit {

    @Input() resource: any; // any pipeline, stage, job, task

    variables: EnvironmentVariable[] = [];
    secrets: EnvironmentVariable[] = [];


    constructor() { }

    ngOnInit() {
        if (!this.resource.environment)
            this.resource.environment = [];

        this.variables = this.resource.environment.filter(e => !e.isSecret);
        this.secrets = this.resource.environment.filter(e => e.isSecret);
    }

    createVariable() {
        this.variables.push({ id: undefined, key: "", value: "", isSecret: false  });
    }
    createSecret() {
        this.secrets.push({ id: undefined, key: "", value: "", isSecret: true  });
    }
}
