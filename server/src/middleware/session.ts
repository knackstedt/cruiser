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
        url: process.env['SURREAL_URL'],
        signinOpts: {
            username: "root",
            password: "root",
        },
        connectionOpts: {
            namespace: "dotglitch",
            database: "cruiser",
        },
        tableName: null
    }),
    unset: "destroy"
}));

export const sessionHandler = router;
