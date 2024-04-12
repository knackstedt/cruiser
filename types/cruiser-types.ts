import { GitHubUser } from './user';
export { };

export const CruiserUserRoles = Object.seal([
    'administrator',
    'manager',
    'user',
    'guest'
]);

export type CruiserUserRole =
    'administrator' |
    'manager' |
    'user' |
    'guest';

export type CruiserUserProfile = {
    login: string,
    id: string,

    name: string,
    label: string,
    roles: CruiserUserRole[],
    image: string
}

// @ts-ignore (agent doesn't have the type for this)
declare module 'express-session' {
    interface SessionData {
        _state: string,

        authority: "github" | "unknown",
        gh_access_token: number,
        gh_scope: string;
        gh_token_type: string,
        gh_user: GitHubUser,

        profile: CruiserUserProfile

        lockout: boolean
    }
}

declare global {
    namespace Express {
        interface Request {
        }
    }
}

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
// globalThis.Error = ErrorWrapper as any;
