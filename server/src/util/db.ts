import Surreal from 'surrealdb.js';

const dbc = new Surreal(process.env['SURREAL_URL'] || 'http://127.0.0.1:8000/rpc');

(async () => {
    await dbc.signin({
        user: process.env['SURREAL_USER'] || 'root',
        pass: process.env['SURREAL_PASSWORD'] || 'root',
    });
    await dbc.use({ ns: 'dotglitch', db: 'dotops' });
})();
export const db = dbc;
