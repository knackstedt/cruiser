import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Fetch } from '@dotglitch/ngx-common';
import { ActiveToast, ToastrService } from 'ngx-toastr';
import { EnvironmentVariable } from 'types/environment';
import { ulid } from 'ulidx';

const $isEditing = Symbol("editing");

@Component({
    selector: 'app-variables-section',
    templateUrl: './variables-section.component.html',
    styleUrls: ['./variables-section.component.scss'],
    imports: [
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        FormsModule
    ],
    standalone: true
})
export class VariablesSectionComponent {
    readonly $isEditing = $isEditing;
    readonly document = document;

    @Input('item') set input( data: any) {
        this.item = data;
        this.ngOnInit();
    };
    item: {
        id: string,
        environment: EnvironmentVariable[]
    };

    @Output() valueChange = new EventEmitter();

    secrets = {};
    constructor(
        private readonly fetch: Fetch,
        private readonly toaster: ToastrService
    ) {

        // Default the first 100 secrets to empty strings
        for (let i = 0; i < 100; i++)
            this.secrets[i] = '';
    }

    ngOnInit() {
        this.item.environment = this.item.environment ?? [];
    }

    onNameChange(el: HTMLInputElement) {
        setTimeout(() => {
            const l = el.value.length;
            // Wipe out any chars that shouldn't be in the name.
            el.value = el.value.replace(/[^A-Za-z0-9_\-]/g, '');

            if (l != el.value.length) {
                this.toaster.warning("Variable keys may only contain alphanumeric characters and underscores.")
            }
        })
    }

    async deleteVariable(env: EnvironmentVariable) {
        if (env.isSecret) {
            await this.fetch.delete(`/api/vault/${this.item.id}/${env.value}`);
        }
        this.item.environment.splice(this.item.environment.indexOf(env), 1);
        this.valueChange.emit();
    }

    makeSecret(env: EnvironmentVariable, i: number) {
        env.isSecret = !env.isSecret;
        if (env.isSecret) {
            this.toaster.info("Hit the check mark to save the secret.")
            this.secrets[i] = env.value;
            env.value = '';
        }
        else {
            env.value = this.secrets[i];
            this.secrets[i] = '';
        }
    }

    addVariable() {
        this.item.environment.push({
            name: '',
            value: '',
            isSecret: false,
            // @ts-ignore
            [$isEditing]: true
        });
        this.valueChange.emit();
    }

    async saveVariable(env, i: number) {
        env[$isEditing] = false;
        if (env.isSecret) {
            if (env.value) {

            }
            const key = ulid();
            await this.fetch.post(`/api/vault/${this.item.id}/${key}`, {
                value: this.secrets[i]
            })
            env.value = key;
        }
        this.valueChange.emit();
    }
}
