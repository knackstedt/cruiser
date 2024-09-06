import Surreal from 'surrealdb.js';
import { environment } from './environment';
import { logger } from './logger';

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

export const connectDatabase = async (
    { database, namespace } = {
        database: environment.surreal_cruiser_database,
        namespace: environment.surreal_cruiser_namespace
    }
) => {

    logger.info({ msg: "Connecting to surrealdb",
        url: environment.surreal_url,
        username: environment.surreal_user
    });

    await dbc.connect(environment.surreal_url);
    await dbc.signin({
        username: environment.surreal_user,
        password: environment.surreal_pass,
        // scope: environment.surreal_scope
    });
    await dbc.use({
        database,
        namespace,
    });

    logger.info({
        msg: "Connected to surrealdb",
        database,
        namespace
    });

    return dbc;
}

/**
 * This is the primary surrealdb connection...
 */
export const connectToSurreal = async () => {
    await connectDatabase({
        database: environment.surreal_cruiser_database,
        namespace: environment.surreal_cruiser_namespace
    });
    isConnected = true;
}

export const afterDatabaseConnected = (fn: Function) =>
    isConnected ? fn() : databaseConnected.then(c => fn());
