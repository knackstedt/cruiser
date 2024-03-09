import { GitHubUser } from './types/user';
export { };

export type CruiserUserRole =
    'administrator' |
    'manager' |
    'user' |
    'guest';

declare module 'express-session' {
    interface SessionData {
        _state: string,

        authority: "github" | "unknown",
        gh_access_token: number,
        gh_scope: string;
        gh_token_type: string,
        gh_user: GitHubUser,
    }
}

declare global {
    namespace Express {
        interface Request {
            roles: CruiserUserRole[]
        }
    }
}
