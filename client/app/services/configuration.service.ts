import { Injectable } from '@angular/core';
import { Fetch } from '@dotglitch/ngx-common';

type Location = {
    label: string,
    path: string,
    icon: string
}

@Injectable({
    providedIn: 'root'
})
export class ConfigurationService {

    homedir: string;
    username: string;
    shell: string;
    host: string;

    currentTheme = "dark";

    ready = false;

    filemanager: {
        maxHistoryLength: number,
        maxUndoLength: number, // max number of actions that can be undone (excluding _destroy_)
        showThumbnails: boolean, // WIP
        thumbnailMaxFileSize: number, // WIP
        customCtxMenuItems: [], // WIP // support for custom context menu actions?

        defaultLocations: Location[],
        deviceLocations: Location[],
        remoteLocations: Location[],
    } = {
        maxHistoryLength: 10,
        maxUndoLength: 50, // max number of actions that can be undone (excluding _destroy_)
        showThumbnails: false, // WIP
        thumbnailMaxFileSize: 0, // WIP
        customCtxMenuItems: [], // WIP // support for custom context menu actions?

        defaultLocations: [],
        deviceLocations: [],
        remoteLocations: [],
    }

    constructor(private fetch: Fetch) {
        this.apply();

        this.fetch.get(`/api/rest`).then((config: any) => {
            this.homedir = config.user.homedir;
            this.username = config.user.username;
            this.shell = config.user.shell;
            this.host = config.host;
            // this.favoriteLocations = config.favoriteLocations;
            this.filemanager.defaultLocations = config.filemanager.defaultLocations;
            this.filemanager.deviceLocations = config.filemanager.deviceLocations;
            this.filemanager.remoteLocations = config.filemanager.remoteLocations;
            this.ready = true;
        })
    }

    // This method invokes to apply any configurations that are stateful across
    // the application.
    apply() {
        // Clear out any old classes
        [...document.body.classList as any as string[]]
            .filter(c =>
                c.startsWith("taskbar-") ||
                c.startsWith("dir-") ||
                c.startsWith("t-")
            )
            .forEach(c => document.body.classList.remove(c));

        document.body.classList.add(`t-${this.currentTheme}`);
    }
}
