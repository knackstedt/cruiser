import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Fetch } from '@dotglitch/ngx-common';
import { Subject, debounceTime } from 'rxjs';
import { PipelineSource } from 'src/types/pipeline';

@Component({
    selector: 'app-edit-source',
    templateUrl: './edit-source.component.html',
    styleUrls: ['./edit-source.component.scss'],
    imports: [
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        FormsModule
    ],
    standalone: true
})
export class EditSourceComponent {

    @Input() source: PipelineSource = {} as any;
    // @Input() type: "github" | "git";

    branches: string[] = [];
    filteredBranches: string[] = [];

    urlChangeEmitter = new Subject();
    urlChange$ = this.urlChangeEmitter.pipe(debounceTime(500));

    subscriptions = [
        this.urlChange$.subscribe(() => this.fetchBranches())
    ]

    constructor(
        private readonly fetch: Fetch
    ) { }

    ngOnInit() {
        this.fetchBranches()
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    fetchBranches() {
        if (this.source.url == 'undefined' || this.source.url?.length < 3) return;

        this.fetch.get<any[]>(`/api/sources/branches?remote=${this.source.url}`)
            .then(r => this.branches = r)
            .catch(e => null);
    }

    filterBranches(input: HTMLInputElement) {
        this.filteredBranches = this.branches
            .filter(b => b.includes(input.value))
    }

    save() {

    }
}
