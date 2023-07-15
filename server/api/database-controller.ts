import * as express from "express";
import { route } from '../util';
import Surreal from 'surrealdb.js';

const db = new Surreal('http://127.0.0.1:8000/rpc');
(async () => {
    await db.signin({
        user: 'root',
        pass: 'root',
    });
    await db.use({ ns: 'dotglitch', db: 'dotops' });

})();


export const DatabaseTableApi = () => {
    const router = express.Router();

    // router.use(proxy('http://127.0.0.1:8000/rpc'));
    /**
     * Scan the library and build the metadata database.
     */
    router.get('/:table', route(async (req, res, next) => {
        res.send(await db.select(req.params['table']));
    }));

    router.post('/:table', route(async (req, res, next) => {
        res.send(await db.create(req.params['table'] + ":ulid()", req.body));
    }));

    // router.use('/:id', (req, res, next) => {
    //     const id = req.params.id as string;
    //     if (!/^[A-Z0-9]{26}$/.test(id)) return next({ message: "Malformed identifier", status: 400 });
    //     next();
    // });

    router.get('/:id', route(async (req, res, next) => {
        res.send(await db.select(req.params['id']));
    }));

    router.put('/:id', route(async (req, res, next) => {
        res.send(await db.update(req.params['id'], req.body));
    }));

    router.patch('/:id', route(async (req, res, next) => {
        res.send(await db.merge(req.params['id'], req.body));
    }));

    router.delete('/:id', route(async (req, res, next) => {
        res.send(await db.delete(req.params['id']));
    }));

    return router;
};
