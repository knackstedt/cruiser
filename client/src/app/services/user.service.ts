import { Injectable } from '@angular/core';
import { Observer, Subject, Subscription } from 'rxjs';
import { Fetch } from '@dotglitch/ngx-common';
import { CruiserUserProfile } from 'src/types/cruiser-types';

@Injectable({
    providedIn: 'root'
})
export class UserService extends Subject<CruiserUserProfile> {
    public value: CruiserUserProfile;


    get isAdministrator() { return this.value?.roles?.includes('administrator') }
    get isManager()       { return this.value?.roles?.includes('manager') || this.value?.roles?.includes('administrator') }
    get isUser()          { return this.value?.roles?.includes('user') }
    get isGuest()         { return this.value?.roles?.includes('guest') }

    constructor(
        private readonly fetch: Fetch,
    ) {
        super();
        window['user'] = this;

        fetch.get<CruiserUserProfile>('/api/user').then(u => {
            if (u['lockedOut'] == true) {
                window.root.isLockedOut = true;
            }
            else {
                this.next(this.value = u);
                window.root.isAuthenticated = true;
            }
        }).finally(() => {
            window.root.isLoggingIn = false;

            setTimeout(() => {
                window.root.renderPageDistractor = false;
            }, 400)
        })
    }

    override subscribe(observer?: Partial<Observer<CruiserUserProfile>>): Subscription;
    override subscribe(next: (value: CruiserUserProfile) => void): Subscription;
    override subscribe(next?: (value: CruiserUserProfile) => void, error?: (error: any) => void, complete?: () => void): Subscription;
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
        location.href = "/api/oauth/gh/logout";
    }
}
