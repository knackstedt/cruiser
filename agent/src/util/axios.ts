import axios from 'axios';
import environment from './environment';

axios.defaults.baseURL = environment.cruiserUrl;
axios.defaults.headers.common['X-Cruiser-Token'] = environment.cruiserToken;
axios.defaults.headers.common['X-Cruiser-Agent'] = environment.agentId;

export const api = axios;
