import axios from 'axios';
import environment from './environment';

axios.defaults.baseURL = environment.cruiserUrl;
axios.defaults.headers.common['Authorization'] = environment.cruiserToken;

export const api = axios;
