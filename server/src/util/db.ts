import Surreal from 'surrealdb.js';

const dbc = new Surreal();

let hasConnected = false;
const connected = new Promise(async (resolve) => {
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

    hasConnected = true;
    resolve(0);
});
export const db = dbc;

export const afterDatabaseConnected = (fn: Function) => {
    if (hasConnected) {
        fn();
    }
    else {
        connected.then(c => fn());
    }
}
