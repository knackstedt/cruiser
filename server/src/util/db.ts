import Surreal from 'surrealdb.js';

const dbc = new Surreal();

(async () => {
    await dbc.connect(process.env['SURREAL_URL'])
    await dbc.signin({
        username: process.env['SURREAL_USER'],
        password: process.env['SURREAL_PASSWORD'],
        namespace: 'dotglitch',
        database: 'cruiser'
    });
    await dbc.use({
        namespace: 'dotglitch',
        database: 'cruiser'
    });
})();
export const db = dbc;
