import axios from 'axios';
import {environment} from './environment';

axios.defaults.baseURL = environment.cruiserUrl;
axios.defaults.headers.common['X-Cruiser-Token'] = environment.cruiserToken;
axios.defaults.headers.common['X-Cruiser-Agent'] = environment.jobInstanceId.split(':')[1];

export const api = axios;
