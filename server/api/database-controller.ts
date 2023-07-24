import * as express from "express";
import { route } from '../util';
import Surreal from 'surrealdb.js';
import { format as AzureOdata } from "azure-odata-sql";

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

const parseOdataParams = (req) => {

    const top = (req.query['$top'] || req.query['$take']) as string;
    const count = req.query['$count'] as string;
    const orderby = req.query['$orderby'] as string;
    const skip = req.query['$skip'] as string;

    // groupby((esa_dt_issue_shortname))
    const apply = req.query['$apply'] as string;

    // ??? so far unused
    const expand = req.query['$expand'] as string;

    // contains(tolower(esa_dt_issue_shortname),'foobar')
    let filter = req.query['$filter'] as string;

    // Enable picking fields
    const fields = req.query['$fields'] as string;

    // ! Sanitize inputs.
    if (typeof top != 'undefined' && /[^0-9]/i.test(top))
        throw { status: 400, message: "malformed $top" };
    if (typeof count != 'undefined' && !/^(true|false)$/i.test(count))
        throw { status: 400, message: "malformed $count" };
    if (typeof orderby != 'undefined' && /['\[\]@;]/i.test(orderby))
        throw { status: 400, message: "malformed $orderby" };
    if (typeof skip != 'undefined' && /[^0-9]/i.test(skip))
        throw { status: 400, message: "malformed $skip" };


    let isDesc = orderby?.endsWith(" desc");
    const order = orderby?.replace(" desc", '').split(',').map(o => `\`${o}\``).join(',');

    let [{ sql, parameters }] = AzureOdata({
        filters: filter,
        ordering: orderby,
        includeDeleted: true,
        table: '',
    }, {
        name: "REPLACE_TABLE",
        schema: "dbo",
        flavor: "mssql",
        softDelete: false
    });

    let skipNum = skip ? parseInt(skip): null;
    let topNum = top ? parseInt(top) : null;

    let ordering = order;
    if (!ordering || ordering.length <= 1)
        ordering = null;
    if (isDesc && ordering)
        ordering += " DESC";

    const where = (sql.split(" WHERE ") || [])[1]?.replace(/\@(p\d+)/g, (match, capture, index, source) => `$` + capture);

    return {
        where: where.replace(/[\[\]]/g, ''),
        params: parameters,
        top: topNum,
        skip: skipNum,
        order: ordering,
        group: null,
        fields: null
    };
}

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
        const { params, skip, top, where, order } = parseOdataParams(req);

        const table = req.params['table'];

        const props = params
            .map(a => ({ [a.name]: a.value }))
            .reduce((a, b) => {
                return {
                    ...a,
                    ...b
                };
            }, {});

        const p_count = db.query([
            `SELECT count() from ${table}`,
            `WHERE ${where}`,
            'GROUP ALL'
        ].join(' '), props);

        const [ output ] = await db.query([
            `SELECT * FROM ${table}`,
            `WHERE ${where}`,
            // `ORDER BY ${order} `,
            typeof top == "number" ? `LIMIT ${top}` : '',
            typeof skip == "number" ? `START ${skip}` : ''
        ].join(' '), props);

        const [{ result: countResult }] = await p_count;
        const [{ count }] = (countResult as any || [{ count: 0 }]);
        // const count = -1;

        const { time, status, result } = output;

        const pars = new URLSearchParams(req.url);
        pars.set('$skip', skip + (result as any[])?.length as any);

        res.send({
            '@odata.context': `/api/db/$metadata#${table}`,
            '@odata.count': count,
            '@odata.nextlink': (top + skip) > (count as number)
                                ? undefined
                                : `/api/db/${table}${decodeURIComponent(pars.toString())}`,
            value: result
        });
    }));


    router.get('/$metadata#:table', route(async (req, res, next) => {
        const table = req.params['table'];
        const schemaFields = Object.keys(((await db.query(`INFO FOR TABLE ` + table))[0].result as any)?.fd);
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
