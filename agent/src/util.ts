import axios from 'axios';
import environment from './environment';

axios.defaults.baseURL = environment.dotopsUrl;
axios.defaults.headers.common['Authorization'] = environment.dotopsToken;

export const api = axios;

export const envSubstitute = (text) =>
    text.replace(/\$\{([^}]+?)\}/g, (match, group) => {
        const [key, placeholder] = group.split('|');
        return process.env[key] || placeholder;
    })
