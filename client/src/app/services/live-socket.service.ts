import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observer, Subject, Subscription } from 'rxjs';
import { BindSocketLogger } from 'src/app/utils/utils';

type LiveRecordChange<T = any> = {
    ev: 'pipeline' | 'pipeline_instance' | 'job_instance',
    data: {
        action: "CREATE" | "UPDATE" | "DELETE",
        result: T
    }
}

@Injectable({
    providedIn: 'root'
})
export class LiveSocketService<T = any> extends Subject<LiveRecordChange<T>> {
    public value: LiveRecordChange<T>;

    private socket: Socket;
    connected = false;

    constructor() {
        super();

        const socket = this.socket = io({
            path: "/socket/live-socket",
            withCredentials: true
        });
        BindSocketLogger("live", socket);

        socket.on("connect", () => {
            socket.emit("$connected");
        });
        socket.on("disconnect", () => {
            this.connected = false;
        });
        // socket.onAny(evt => console.log("live_socket", evt))
        socket.on("live:pipeline",          (data) => this.next({ ev: "pipeline", data }));
        socket.on("live:pipeline_instance", (data) => this.next({ ev: "pipeline_instance", data }));
        socket.on("live:job_instance",      (data) => this.next({ ev: "job_instance", data }));
    }

    override subscribe(observer?: Partial<Observer<LiveRecordChange<T>>>): Subscription;
    override subscribe(next: (value: LiveRecordChange<T>) => void): Subscription;
    override subscribe(next?: (value: LiveRecordChange<T>) => void, error?: (error: any) => void, complete?: () => void): Subscription;
    override subscribe(next?: unknown, error?: unknown, complete?: unknown): import("rxjs").Subscription {
        if (this.value != undefined) {
            // @ts-ignore
            next(this.value);
        }

        // @ts-ignore
        return super.subscribe(next, error, complete);
    }
}
