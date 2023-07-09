import { Injectable } from '@angular/core';
import { Fetch } from 'client/app/services/fetch.service';
import { Observer, Subject, Subscription } from 'rxjs';

type User = {
    name: string,
    email: string
};

@Injectable({
    providedIn: 'root'
})
export class UserService extends Subject<User> {
    public value: User;

    constructor(
        private fetch: Fetch
    ) {
        super();
        fetch.get('/api/user').then(u => this.next(u as User))
    }

    override subscribe(observer?: Partial<Observer<User>>): Subscription;
    override subscribe(next: (value: User) => void): Subscription;
    override subscribe(next?: (value: User) => void, error?: (error: any) => void, complete?: () => void): Subscription;
    override subscribe(next?: unknown, error?: unknown, complete?: unknown): import("rxjs").Subscription {
        if (this.value != undefined) {
            // @ts-ignore
            next(this.value);
        }

        // @ts-ignore
        return super.subscribe(next, error, complete);
    }
}
