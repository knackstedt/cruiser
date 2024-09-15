import 'tslib';


export type ErrorData = {
    msg: string,
    [key: string]: any;
} | {
    message: string,
    [key: string]: any;
};

declare global {
    interface ErrorConstructor {
        new(arg1: string | ErrorData, arg2?: ErrorData): Error;
        (arg1: string | ErrorData, arg2?: ErrorData): Error;
        readonly prototype: Error;
    }
}
