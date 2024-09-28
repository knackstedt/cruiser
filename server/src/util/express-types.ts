import { CruiserUserProfile } from '../types/cruiser-types';
import { GitHubUser } from '../types/user';

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

