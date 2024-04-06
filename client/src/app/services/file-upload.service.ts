import { Injectable } from '@angular/core';
import { Fetch } from '@dotglitch/ngx-common';
import { PipelineDefinition } from 'types/pipeline';
import { ulid } from 'ulidx';

@Injectable({
    providedIn: 'root'
})
export class FileUploadService {

    constructor(
        private readonly fetch: Fetch
    ) { }

    async onImageUpload(pipeline: PipelineDefinition, evt) {
        const path = `/${pipeline.id}/`;
        let formData = new FormData();

        Object.keys(evt.data).forEach(k => {
            const file: {
                lastModified: number,
                lastModifiedDate: Date,
                name: string,
                size: number,
                type: string;
            } = evt.data[k];

            const parts = file.name.split('.');
            const name = parts.slice(0, -1).join('.') + '-' + ulid() + '.' + parts.slice(-1)[0];
            formData.append(name, file as any);
        });
        formData.append("data", JSON.stringify({
            path,
            pipeline: pipeline.id,
            autoRename: true
        }));

        const url = `/api/blobstore/upload`;

        const { files } = await this.fetch.post<{ files: { url: string, name: string; }[]; }>(url, formData);

        evt.stackEditor.finalizeImageUpload({
            label: files[0].name,
            link: files[0].url
        });
    }
}
