import Surreal from 'surrealdb.js';
import { environment } from './environment';

export const connectDatabase = async (
    { database, namespace } = {
        database: environment.surreal_cruiser_database,
        namespace: environment.surreal_cruiser_namespace
    },
    instance?: Surreal
) => {
    instance ??= new Surreal();

    await instance.connect(environment.surreal_url);
    await instance.signin({
        username: environment.surreal_user,
        password: environment.surreal_pass,
        // scope: environment.surreal_scope
    });
    await instance.use({
        database,
        namespace,
    });

    return instance;
}

const dbc = new Surreal();

let isConnected = false;
const databaseConnected = new Promise(async (resolve) => {
    const i = setInterval(() => {
        if (isConnected) {
            clearInterval(i);
            resolve(0);
        }
    }, 10)
});
export const db = dbc;

/**
 * This is the primary surrealdb connection...
 */
export const connectToSurreal = async () => {
    await connectDatabase({
        database: environment.surreal_cruiser_database,
        namespace: environment.surreal_cruiser_namespace
    }, dbc);
    isConnected = true;
}

export const afterDatabaseConnected = (fn: Function) =>
    isConnected ? fn() : databaseConnected.then(c => fn());
