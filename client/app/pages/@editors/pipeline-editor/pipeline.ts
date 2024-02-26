export class Pipeline {
    id: string;
    name: string;

    constructor() {

    }

    save() {
        if (this.id) {
            return fetch(`/api/odata/${this.id}`, {
                method: "patch",
                body: JSON.stringify({
                    ...this
                })
            })
        }
        else {
            return fetch(`/api/odata/pipelines`, {
                method: "post",
                body: JSON.stringify({
                    ...this
                })
            })
        }
    }

    static create(data: Object) {

    }

    static fromJson(data: Object) {
        const pipeline = new Pipeline();
        Object.assign(data, pipeline);

        return pipeline;
    }
}
