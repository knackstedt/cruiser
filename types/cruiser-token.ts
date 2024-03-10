export type CruiserToken = {
    id: string,
    hash: string,
    name: string,
    description: string,
    roles: string,

    owner: string,
    ownerId: string | number,
    expires: number
}
