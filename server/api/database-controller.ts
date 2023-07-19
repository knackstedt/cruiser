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


// List of tables that cannot be accessed through this endpoint.
const tableBlackList = [
    "secrets"
]

export const checkSurrealResource = (resource: string) => {
    const [table, id] = resource.split(':');

    if (id && !/^[0-7][0-9A-F]{25}$/.test(id))
        throw { status: 400, message: "Invalid resource" };

    if (tableBlackList.includes(table.toLowerCase()))
        throw { status: 403, message: "You do not have access to this resource" };

    return resource;
}

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

        if (!Array.isArray(req.body)) {
            res.send((await db.create(checkSurrealResource(req.params['table']) + ":ulid()", req.body))[0]);
        }
        else {
            res.send(await Promise.all(req.body.map(({ data }) => db.create(checkSurrealResource(req.params['table']) + ":ulid()", data))));
        }
    }));

    // router.use('/:id', (req, res, next) => {
    //     const id = req.params.id as string;
    //     if (!/^[A-Z0-9]{26}$/.test(id)) return next({ message: "Malformed identifier", status: 400 });
    //     next();
    // });

    router.get('/:id', route(async (req, res, next) => {
        res.send((await db.select(checkSurrealResource(req.params['id'])))[0]);
    }));

    // batch get
    // [ "id:123", "id:456" ]
    router.get('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(req.body.map((id) => db.select(checkSurrealResource(id)).then(([entry]) => entry))));
    }));



    router.put('/:id', route(async (req, res, next) => {
        res.send(await db.update(checkSurrealResource(req.params['id']), req.body));
    }));
    // batch PUT
    // [{ id: "id123", data: {prop1: val}}]
    router.put('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(req.body.map(({ id, data }) => db.update(checkSurrealResource(id), data))));
    }));



    router.patch('/:id', route(async (req, res, next) => {
        res.send(await db.merge(checkSurrealResource(req.params['id']), req.body));
    }));

    // batch patch
    // [{ id: "id123", data: {prop1: val}}]
    router.patch('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(req.body.map(({id, data}) => db.merge(checkSurrealResource(id), data).then(e => e[0]))));
    }));



    router.delete('/:id', route(async (req, res, next) => {
        res.send(await db.delete(checkSurrealResource(req.params['id'])));
    }));

    // batch delete
    // [ "id:123", "id:456" ]
    router.delete('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(req.body.map((id) => db.delete(checkSurrealResource(id)))));
    }));

    return router;
};
