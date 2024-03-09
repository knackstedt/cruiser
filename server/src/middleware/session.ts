import session from 'express-session';
import express from 'express';
import { SurrealDBStore } from 'connect-surreal';

const router = express.Router();


router.use(session({
    secret: process.env['SESSION_SECRET'],
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
            username: process.env['SURREAL_USER'],
            password: process.env['SURREAL_PASSWORD'],
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
