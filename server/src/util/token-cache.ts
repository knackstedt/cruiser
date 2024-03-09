const tokenCache: string[] = [];

export const GetJobToken = (token) => tokenCache.includes(token);
export const SetJobToken = (token: string) => tokenCache.push(token);
