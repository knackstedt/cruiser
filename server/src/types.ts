import { GitHubUser } from './types/user';
export { };

declare module 'express-session' {
    interface SessionData {
        _state: string,

        authority: "github" | "unknown",
        gh_access_token: number,
        gh_scope: string;
        gh_token_type: string,
        gh_user: GitHubUser
    }
}

declare global {
    namespace Express {
        interface Request {
        }
    }
}
