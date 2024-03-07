import Surreal from 'surrealdb.js';

const dbc = new Surreal();

(async () => {
    await dbc.connect(process.env['SURREAL_URL'] || 'http://127.0.0.1:8000/rpc')
    await dbc.signin({
        username: process.env['SURREAL_USER'] || 'root',
        password: process.env['SURREAL_PASSWORD'] || 'root',
    });
    await dbc.use({ namespace: 'dotglitch', database: 'cruiser' });
})();
export const db = dbc;
