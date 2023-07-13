import Surreal from 'surrealdb.js';

const dbc = new Surreal('http://127.0.0.1:8000/rpc');
await dbc.signin({
    user: 'root',
    pass: 'root',
});
await dbc.use({ ns: '@dotglitch', db: 'dotops' });


export const db = dbc;
