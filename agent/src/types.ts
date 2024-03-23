
/**
 * This error override makes it possible to pass json objects
 * as additional detail to errors.
 * This also fixes the error.toJson() => {} issue. Errors will
 * properly serialize into objects.
 */
class ErrorWrapper extends Error {
    private data: Object;
    private data2: Object;

    constructor(data?: Object | string, additionalProps?: Object) {
        super(
            typeof data == "object"
                ? data?.['msg'] || data?.['message'] || data?.['title'] || "Error"
                : data
        );

        if (typeof data == "object") {
            this.data = data;
            Object.assign(this, data);
        }
        if (typeof additionalProps == "object") {
            this.data2 = additionalProps;
            Object.assign(this, additionalProps);
        }
    }

    toJSON() {
        return {
            stack: this.stack,
            message: this.message,
            name: this.name,
            ...(this.data || {}),
            ...(this.data2 || {})
        };
    }
}
globalThis.Error = ErrorWrapper as any;
