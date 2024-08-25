import session from 'express-session';
import express from 'express';
import { SurrealDBStore } from 'connect-surreal';
import { ulid } from 'ulidx';
import { environment } from '../util/environment';

const router = express.Router();

const store = new SurrealDBStore({
    url: environment.surreal_url,
    signinOpts: {
        username: environment.surreal_user,
        password: environment.surreal_pass,
    },
    connectionOpts: {
        namespace: environment.express_session_namespace,
        database: environment.express_session_database,
    },
    tableName: environment.express_session_table
});

router.use(session({
    secret: environment.express_session_secret,
    saveUninitialized: false,
    resave: false,
    cookie: {
        // path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 1
    },
    genid: () => ulid(),
    store: store,
    unset: "destroy"
}));

export const SessionMiddleware = router;
