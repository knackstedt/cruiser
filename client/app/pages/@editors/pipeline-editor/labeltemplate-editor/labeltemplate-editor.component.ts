import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import * as ts from 'typescript';
import * as monacoEditor from 'monaco-editor';
import { sleep } from 'client/app/services/utils';
import { Fetch } from 'client/app/services/fetch.service';
import { VscodeComponent } from '@dotglitch/ngx-web-components';
import { MatButtonModule } from '@angular/material/button';

const monacoContext = `
type LabelTemplateContext = {
    pipeline: Pipeline
}

${require('!raw-loader!types/agent-task.ts').default}
${require('!raw-loader!types/environment.ts').default}
${require('!raw-loader!types/history-object.ts').default}
${require('!raw-loader!types/pipeline.ts').default}
`.replace(/^(export |import[^\n]+)/gm, '');

console.log(monacoContext);

@Component({
    selector: 'app-labeltemplate-editor',
    templateUrl: './labeltemplate-editor.component.html',
    styleUrls: ['./labeltemplate-editor.component.scss'],
    imports: [
        VscodeComponent,
        MatButtonModule
    ],
    standalone: true
})
export class LabeltemplateEditorComponent implements OnInit {

    // import { DynatraceTenantAPI } from '@dt-esa/dynatrace-api-client';

    readonly defaultTemplate = `
import * as ts from 'typescript';

export default async (ctx: LabelTemplateContext) => {

}`;

    @Input() labelTemplate = '';
    @Output() labelTemplateChange = new EventEmitter<string>();
    result = '';

    constructor(
        private fetch: Fetch,

    ) { }

    ngOnInit() {
        this.registerTypings();
    }

    private async registerTypings() {
        await new Promise(async r => {
            while (!window['monaco'])
                await sleep(20);
            r(0);
        });

        const monaco: typeof monacoEditor = window['monaco'];
        const defaults = monaco.languages.typescript.typescriptDefaults;
        defaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            typeRoots: [
                "@dt-esa/dynatrace-api-client"
            ],

        });

        defaults.addExtraLib(monacoContext);
    }

    async testApi() {
        const options: ts.TranspileOptions = {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ES2020
            }
        };
        const compiled = ts.transpileModule(this.labelTemplate, options);
        const code = compiled.outputText.replace(/^export default /, '');

        const ctx = {

        };

        try {
            const fn = eval(code);
            const res = await fn(ctx);
            this.result = JSON.stringify(res, null, 4);
        }
        catch (ex) {
            // this.toaster.warn("Invalid CODE", ex.message);
        }
    }


    test() {

    }
    clear() {

    }
    reset() {
        this.labelTemplate = this.defaultTemplate;
        this.labelTemplateChange.next(this.labelTemplate);
    }
}
