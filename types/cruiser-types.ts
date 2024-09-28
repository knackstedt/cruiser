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
    image: string,

    favoritePipelines: string[],
    favoriteProjects: string[],
}

