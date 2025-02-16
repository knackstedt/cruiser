import { Injectable } from '@angular/core';
import { Fetch } from '@dotglitch/ngx-common';
import { TaskLibraryItem } from '../../../../types/task-definition';

@Injectable({
    providedIn: 'root'
})
export class TaskLibraryService {

    tasks: TaskLibraryItem[];

    constructor(private fetch: Fetch) {
        // Get all of the task definitions
        this.fetch.get(`/api/odata/task-definition`).then((config: any) => {

        })
    }

    // ??? Should these be capable of connecting to a 'global' or local repository?
    // DefineTask
    // DeleteTask
    // UpdateTask
}
