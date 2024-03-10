import { GitHubUser } from './types/user';
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
