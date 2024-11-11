import { Injectable } from '@angular/core';
import { Observer, Subject, Subscription } from 'rxjs';
import { Fetch } from '@dotglitch/ngx-common';

type Project = {

}

@Injectable({
    providedIn: 'root'
})
export class ProjectService extends Subject<Project> {
    public value: Project;

    public projects: Project[] = [];

    constructor(
        private readonly fetch: Fetch,
    ) {
        super();
        this.fetchProjects();
    }

    override subscribe: Subject<Project>['subscribe'] = (...args) => {
        if (this.value != undefined) args[0](this.value);
        return super.subscribe(...args);
    }

    async fetchProjects() {
        this.projects = await this.fetch.get('/api/odata/project');
        this.value = this.projects[0];
    }
}
