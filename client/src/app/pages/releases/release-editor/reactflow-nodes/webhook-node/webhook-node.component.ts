import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { ReleaseEditorComponent } from '../../release-editor.component';
import { StageDefinition } from 'src/types/pipeline';

@Component({
    selector: 'app-webhook-node',
    templateUrl: './webhook-node.component.html',
    styleUrls: ['./webhook-node.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MenuDirective
    ],
    standalone: true
})
export class WebhookNodeComponent {

    @Input() data: { stage: StageDefinition, releaseEditor: ReleaseEditorComponent };
    @Input() editing = true;
    @Input() contextMenu: MenuItem[] = [];

    @Output() onEditWebhook = new EventEmitter();

    get stage() { return this.data.stage };
    get selectedWebhook() { return this.data.releaseEditor?.selectedWebhook };
    get webhooks() { return this.stage.webhooks };

    ngOnInit() { console.log(this) }

    getHost(url: string) {
        try {
            return new URL(url).host;
        }
        catch {
            return "New Webhook";
        }
    }

}
