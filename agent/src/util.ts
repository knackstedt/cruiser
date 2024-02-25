import { Axios } from 'axios';
import environment from './environment';

export const api = new Axios({
    baseURL: environment.dotopsUrl,
    headers: {
        "Authorization": environment.dotopsToken
    }
});
