import * as express from "express";
import { route } from '../util/util';
import Surreal from 'surrealdb.js';
import { SQLLang, createQuery } from '@dotglitch/odatav4';
import { Visitor } from '@dotglitch/odatav4/dist/visitor';

const db = new Surreal();
(async () => {
    await db.connect(process.env['SURREAL_URL'] || 'http://127.0.0.1:8000');
    await db.signin({
        username: process.env['SURREAL_USER'] || 'root',
        password: process.env['SURREAL_PASSWORD'] || 'root',
    });
    await db.use({ namespace: 'dotglitch', database: 'cruiser' });
})();


// List of tables that cannot be accessed through this endpoint.
const tableBlackList = [
]

export const checkSurrealResource = (resource: string) => {
    const [table, id] = resource.split(':');

    if (id && !/^[0-7][0-9A-Z]{25}$/.test(id))
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
        const table = req.params['table'];

        const apiPath = '/api/odata';

        const addOdataMetadata = (obj) => {
            obj["@odata.id"] = `${apiPath}/${table}('${obj.id}')`;
            // obj["@odata.etag"] = "W/\"08D1694C7E510464\"";
            obj["@odata.editLink"] = `${apiPath}/${table}('${obj.id}')`;
            return obj;
        }


        if (table.includes(":")) {
            const [output] = await db.select(table);
            res.send(output);
            return;
        }

        const [ unused, queryString ] = req.url.split('?');

        const hasFilter = queryString?.includes("$filter");

        const query = hasFilter ? createQuery(decodeURIComponent(queryString), {
            type: SQLLang.SurrealDB
        }) : {} as Visitor;

        const {
            select,
            where,
            parameters,
            skip,
            limit,
            orderby
        } = query;

        const props = {};
        parameters?.forEach((value, key) => props[key] = value);

        const p_count = db.query([
            `SELECT count() from ${table}`,
            `${where ? 'WHERE (' + where + ')' : ''}`,
            'GROUP ALL'
        ].join(' '), props);

        const sql = [
            `SELECT ${select || '*'} FROM ${table}`,
            `${where ? 'WHERE (' + where + ')' : ''}`,
            (typeof orderby == "string" && orderby != '1') ? `ORDER BY ${orderby}` : '',
            typeof limit == "number" ? `LIMIT ${limit}` : '',
            typeof skip == "number" ? `START ${skip}` : ''
        ].join(' ');
        const [{result: data}] = await db.query(sql, props);

        const [{ result: countResult }] = await p_count as any;
        const count = countResult[0]?.count;

        const pars = new URLSearchParams(req.url);
        pars.set('$skip', skip + (data as any)?.length as any);

        res.send({
            '@odata.context': `${apiPath}$metadata#${table}`,
            '@odata.count': count ?? (data as any)?.length ?? 0,
            '@odata.nextlink': (limit + skip) > (count as number)
                                ? undefined
                                : `${apiPath}/${table}${decodeURIComponent(pars.toString())}`,
            value: (data as any).map(d => addOdataMetadata(d))
        });
    }));


    router.get('/$metadata#:table', route(async (req, res, next) => {
        const table = req.params['table'];
        const schemaFields = Object.keys(((await db.query(`INFO FOR TABLE ` + table))[0][0].result as any)?.fd);
        res.send(schemaFields);
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
        const data = await db.select(checkSurrealResource(req.params['id']));
        res.send(data[0]);
    }));

    // batch get
    // [ "id:123", "id:456" ]
    router.get('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(
            req.body.map((id) =>
                db.select(checkSurrealResource(id))
                .then(([d]) => d)
            )
        ));
    }));



    router.put('/:id', route(async (req, res, next) => {
        res.send((await db.update(checkSurrealResource(req.params['id']), req.body))[0]);
    }));
    // batch PUT
    // [{ id: "id123", data: {prop1: val}}]
    router.put('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(
            req.body.map(({id, data}) =>
                db.update(
                    checkSurrealResource(id),
                    data
                )
                .then(([d]) => d)
            )
        ));
    }));

    router.patch('/:id', route(async (req, res, next) => {
        res.send(
            (await db.merge(
                checkSurrealResource(req.params['id']),
                req.body
            ))[0]
        );
    }));

    // batch patch
    // [{ id: "id123", data: {prop1: val}}]
    router.patch('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(
            req.body.map(({id, data}) =>
                db.merge(
                    checkSurrealResource(id),
                    data
                )
                .then(([d]) => d)
            )
        ));
    }));



    router.delete('/:id', route(async (req, res, next) => {
        res.send((await db.delete(checkSurrealResource(req.params['id']))[0]));
    }));

    // batch delete
    // [ "id:123", "id:456" ]
    router.delete('/', route(async (req, res, next) => {
        if (!Array.isArray(req.body)) throw 400;

        res.send(await Promise.all(
            req.body.map((id) =>
                db.delete(
                    checkSurrealResource(id)
                )
                .then(([d]) => d)
            )
        ));
    }));

    return router;
};
