import session from 'express-session';
import express from 'express';
import { SurrealDBStore } from 'connect-surreal';

const router = express.Router();


router.use(session({
    secret: 'foobar',
    // proxy: true,
    // resave: false,
    saveUninitialized: false,
    cookie: {
        // path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 1
    },
    store: new SurrealDBStore({
        url: "http://127.0.0.1:8000/rpc",
        signinOpts: {
            username: "root",
            password: "root",
        },
        connectionOpts: {
            namespace: "dotglitch",
            database: "cruiser",
        },
        tableName: "sessions"
    }),
    unset: "destroy"
}));

export const sessionHandler = router;
