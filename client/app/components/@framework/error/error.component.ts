import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'app-window-error',
    templateUrl: './error.component.html',
    styleUrls: ['./error.component.scss']
})
export class WindowErrorComponent implements OnInit {

    @Input() error: any;
    stacktrace: string;
    codeSnippet: string;
    
    ngOnInit() {
    }
}
