import Surreal from 'surrealdb.js';
import { environment } from './environment';

const dbc = new Surreal();

export const db = dbc;

export const connectDatabase = async () => {
    await dbc.connect(environment.surreal_url);
    await dbc.signin({
        username: environment.surreal_user,
        password: environment.surreal_pass,
        scope: environment.surreal_scope
    });
    await dbc.use({
        namespace: environment.surreal_cruiser_namespace,
        database: environment.surreal_cruiser_database,
    });

    return dbc.wait();
}


