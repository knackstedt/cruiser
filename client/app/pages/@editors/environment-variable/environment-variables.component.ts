import { NgForOf, NgIf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EnvironmentVariableComponent } from './environment-variable/environment-variable.component';
import { Pipeline } from 'types/pipeline';
import { EnvironmentVariable } from 'types/environment';

@Component({
    selector: 'app-environment-variable',
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

    @Input() pipeline: Pipeline;

    variables: EnvironmentVariable[] = [];
    secrets: EnvironmentVariable[] = [];


    constructor() { }

    ngOnInit() {
        if (!this.pipeline.environment)
            this.pipeline.environment = [];

        this.variables = this.pipeline.environment.filter(e => !e.isSecret);
        this.secrets = this.pipeline.environment.filter(e => e.isSecret);
    }

    createVariable() {
        this.variables.push({ key: "", value: "", isSecret: false  });
    }
    createSecret() {
        this.secrets.push({ key: "", value: "", isSecret: true  });
    }
}
