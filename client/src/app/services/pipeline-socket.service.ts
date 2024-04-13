import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observer, Subject, Subscription } from 'rxjs';
import { JobInstance } from 'src/types/agent-task';
import { BindSocketLogger } from 'src/app/utils/utils';

type LiveRecordChange<T = any> = {
    ev: 'pipeline' | 'pipeline_instance' | 'job_instance',
    data: {
        action: "CREATE" | "UPDATE" | "DELETE",
        result: T;
    };
};

@Injectable({
    providedIn: 'root'
})
export class PipelineSocketService<T = any> extends Subject<LiveRecordChange<T>> {
    public value: LiveRecordChange<T>;

    private socket: Socket;
    connected = false;

    constructor() {
        super();

        const socket = this.socket = io({
            path: "/ws/socket-service",
            withCredentials: true
        });
        BindSocketLogger("live", socket);

        socket.on("connect", () => {
        });
        socket.on("disconnect", () => {
            this.connected = false;
        });
    }

    emit(event: string, data?: any) {
        this.socket.emit(event, data);
    }
}
