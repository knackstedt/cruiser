import Surreal from 'surrealdb.js';
import { environment } from './environment';

const dbc = new Surreal();

let hasConnected = false;
const connected = new Promise(async (resolve) => {
    await dbc.connect(environment.surreal_url)
    await dbc.signin({
        username: environment.surreal_user,
        password: environment.surreal_pass
    });
    await dbc.use({
        namespace: environment.surreal_cruiser_namespace,
        database: environment.surreal_cruiser_database
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
