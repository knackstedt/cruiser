import { Injectable } from '@angular/core';
import { Observer, Subject, Subscription } from 'rxjs';
import { Fetch } from '@dotglitch/ngx-common';
import { RootComponent } from 'client/app/root.component';
import { GitHubUser } from 'client/types/user';


@Injectable({
    providedIn: 'root'
})
export class UserService extends Subject<GitHubUser> {
    public value: GitHubUser;

    get root() {
        return window['root'] as RootComponent
    }

    constructor(
        private readonly fetch: Fetch,
    ) {
        super();
        window['user'] = this;

        fetch.get<GitHubUser>('/api/user').then(u => {
            this.root.isAuthenticated = true;
            this.next(this.value = u);
        })
    }

    override subscribe(observer?: Partial<Observer<GitHubUser>>): Subscription;
    override subscribe(next: (value: GitHubUser) => void): Subscription;
    override subscribe(next?: (value: GitHubUser) => void, error?: (error: any) => void, complete?: () => void): Subscription;
    override subscribe(next?: unknown, error?: unknown, complete?: unknown): import("rxjs").Subscription {
        if (this.value != undefined) {
            // @ts-ignore
            next(this.value);
        }

        // @ts-ignore
        return super.subscribe(next, error, complete);
    }

    login() {
        location.href = "/api/oauth/gh/login";
    }

    logout() {

    }
}
