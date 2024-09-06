import { db } from './db';

const tokenCache: string[] = [];

export const CheckJobToken = async (token: string) => {
    if (tokenCache.includes(token))
        return true;

    const [results] = await db.query<any[]>("select * from agent_tokens where token = $p", { p: token });

    return results.length == 1;
};
export const SetJobToken = (token: string) => {
    tokenCache.push(token);
    db.create(`agent_tokens:ulid()`, { token });
};
