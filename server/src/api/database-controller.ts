import * as express from "express";
import { route } from '../util/util';
import { SQLLang, createQuery } from '@dotglitch/odatav4';
import { Visitor } from '@dotglitch/odatav4/dist/visitor';

import { db } from '../util/db';
import { CruiserUserRole } from '../types/cruiser-types';

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

const tableGuard = (req, res, next) => {
    let target = req.params.table;

    let targetId: string;
    if (target.startsWith("(")) {
        if (target.endsWith(")")) {
            targetId = target.slice(1, -1);
        }
        else {
            throw { status: 400, message: "Unauthorized" };
        }
    }

    const [table, id] = (targetId ?? target).split(':');

    if (id && !/^[0-7][0-9A-Z]{25}$/.test(id))
        throw { status: 400, message: "Invalid resource" };

    if (tableBlackList.includes(table.toLowerCase()))
        throw { status: 403, message: "You do not have access to this resource" };

    // Verify the table name is semantically valid
    if (/[^a-zA-Z0-9_-]/.test(table))
        throw { status: 404, message: "Invalid target" };

    const tableConfig = tableConfigMap[table];

    if (tableConfig?.accessControl) {
        const groups = req.session.profile.roles;
        const { read, patch, delete: del, post, write, all } = tableConfig.accessControl;

        if (read && req.method == 'get') {
            if (!read.find(r => groups.includes(r)))
                throw { status: 403, message: "Forbidden" };
        }

        if (patch && req.method == 'patch') {
            if (!patch.find(r => groups.includes(r)))
                throw { status: 403, message: "Forbidden" };
        }

        if (del && req.method == 'delete') {
            if (!del.find(r => groups.includes(r)))
                throw { status: 403, message: "Forbidden" };
        }

        if (post && req.method == 'post') {
            if (!post.find(r => groups.includes(r)))
                throw { status: 403, message: "Forbidden" };
        }

        // If it's something that would modify a table, check for write access.
        if (write && ['post', 'patch', 'delete'].includes(req.method)) {
            if (!write.find(r => groups.includes(r)))
                throw { status: 403, message: "Forbidden" };
        }
    }

    req['_tableConfig'] = tableConfig;
    req['_table'] = table;
    req['_id'] = id;

    next();
}

/**
 * Parse the request URL and build queries
 */
const requestToOdataGet = async (
    table: string,
    req
) => {
    const [path, queryString] = req.url.split('?');
    const hasFilter = queryString?.includes("$filter");

    let finalQuery: string[] = [];
    // TODO: Fix the upstream parser problem on dot notation
    for (let i = 0; i < queryString?.length; i++) {
        const char = queryString[i];

        if (char == '\'') {
            const to = queryString.indexOf('\'', i);
            if (to == -1) {
                throw { status: 400, message: "Malformed Odata" };
            }

            finalQuery.push(queryString.slice(i, to));

            i = to;
            continue;
        }
        if (char == '.') {
            finalQuery.push('__DOT__');
            continue;
        }
        finalQuery.push(char);
    }
    const finalQueryString = finalQuery.join('').replace(/[&?]\$fetch=[^&]+/, '');

    const query = hasFilter ? createQuery(decodeURIComponent(finalQueryString), {
        type: SQLLang.SurrealDB
    }) : {} as Visitor;

    const {
        select,
        where,
        parameters,
        skip,
        limit,
        orderby
    } = (() => {
        let { select, where, parameters, skip, limit, orderby } = query;

        select = select?.replace(/__DOT__/g, '.');
        where = where?.replace(/__DOT__/g, '.');
        orderby = orderby?.replace(/__DOT__/g, '.')
            .replace(/\]/g, '')
            .replace(/\[/g, '');

        return { select, where, parameters, skip: skip || 0, limit, orderby };
    })();

    const fetch = (() => {
        const fetchPar = req.query['$fetch'];
        if (!fetchPar) return '';

        const fields = !Array.isArray(fetchPar) ? [fetchPar] : fetchPar;
        const fetchStr = fields.join(", ");

        // Validate that the format is generally safe to execute.
        if (!/^(?:[a-zA-Z_\.]+?)(?:, [a-zA-Z_\.]+?)*$/.test(fetchStr))
            throw { status: 400, message: "Malformed $fetch" };

        return fetchStr;
    })();

    const properties = {};
    parameters?.forEach((value, key) => properties[key] = value);

    // Initiate a query to count the number of total records that match
    const countQuery = [
        `SELECT count() from ${table}`,
        `${where ? 'WHERE (' + where + ')' : ''}`,
        'GROUP ALL'
    ].join(' ');

    // Build a full query that we will throw at surreal
    const entriesQuery = [
        `SELECT ${select || '*'} FROM ${table}`,
        `${where ? 'WHERE (' + where + ')' : ''}`,
        (typeof orderby == "string" && orderby != '1') ? `ORDER BY ${orderby}` : '',
        typeof limit == "number" ? `LIMIT ${limit}` : '',
        typeof skip == "number" ? `START ${skip}` : '',
        `${fetch ? 'FETCH ' + fetch : ''}`
    ].join(' ');

    return {
        countQuery,
        entriesQuery,
        properties,
        skip,
        limit
    }
}

type TableConfig = {
    /**
     *
     */
    [key: string]: {

        accessControl?: {
            read?: CruiserUserRole[],
            post?: CruiserUserRole[],
            patch?: CruiserUserRole[],
            delete?: CruiserUserRole[],

            // Write encompasses `post` `patch` and `delete` together.
            write?: CruiserUserRole[];
            // Ensure that the user has at least one of the listed roles,
            // for ANY of the methods
            all?: CruiserUserRole[];
        }

        afterGet?: (record: Object) => Promise<Object> | Object
        afterPost?: (record: Object) => Promise<Object> | Object
        afterPut?: (record: Object) => Promise<Object> | Object
        afterPatch?: (record: Object) => Promise<Object> | Object
        afterDelete?: (record: Object) => Promise<Object> | Object

        beforePost?: (record: Object) => Promise<Object> | Object;
        beforePut?: (record: Object) => Promise<Object> | Object;
        beforePatch?: (record: Object) => Promise<Object> | Object;
        beforeDelete?: (record: Object) => Promise<Object> | Object
    }
}

// Set restrictions on who can read/write/update on a table.
// If not present, the table will effectively have no permission
// constraints
const tableConfigMap: TableConfig = {
    "users": {
        accessControl: {
            write: ["administrator"]
        }
    }
}

export const DatabaseTableApi = () => {
    const router = express.Router();
    const apiPath = '/api/odata';

    // All requests must satisfy the guard.
    router.use('/:table', tableGuard);

    /**
     * Metadata endpoint must be first
     * TODO: Should this endpoint be secured?
     * Seems arbitrary on the surface
     */
    router.get('/$metadata#:table', route(async (req, res, next) => {
        const table = req['_table'] as string;
        const schemaFields = Object.keys((
            (await db.query(`INFO FOR TABLE ` + table))[0][0].result as any)?.fd
        );
        res.send(schemaFields);
    }));

    /**
     *
     */
    router.get('/:table', route(async (req, res, next) => {
        const tableConfig = req['_tableConfig'] as TableConfig[''] || {};
        const table = req['_table'] as string;

        const addOdataMetadata = (obj) => {
            obj["@odata.id"] = `${apiPath}/${table}('${obj.id}')`;
            // obj["@odata.etag"] = "W/\"08D1694C7E510464\"";
            obj["@odata.editLink"] = `${apiPath}/${table}('${obj.id}')`;
            return obj;
        };

        // If the target includes a colon, then we're acting on 1 record
        if (req.params['table']?.includes(":")) {
            let [result] = await db.select<any>(table);

            if (typeof tableConfig.afterGet == "function")
                result = await tableConfig.afterGet(result);

            res.send(result);
            return;
        }

        const {
            countQuery,
            entriesQuery,
            properties,
            skip,
            limit
        } = await requestToOdataGet(
            table,
            req
        );

        let [
            countResult,
            [data]
        ] = await Promise.all([
            db.query<any>(countQuery, properties),
            db.query<any[]>(entriesQuery, properties)
        ])
        data ??= [];
        // const count = countResult.count;
        const count = countResult?.[0]?.[0]?.count || 0;

        // Add odata metadata properties
        data = data.map(d => addOdataMetadata(d));

        const pars = new URLSearchParams(req.url);
        pars.set('$skip', skip + data.length as any);

        res.send({
            '@odata.context': `${apiPath}$metadata#${table}`,
            '@odata.count': count ?? data.length ?? 0,
            '@odata.nextlink': (limit + skip) > (count as number)
                                ? undefined
                                : `${apiPath}/${table}${decodeURIComponent(pars.toString())}`,
            value: data
        });
    }));

    router.post('/:table', route(async (req, res, next) => {
        const tableConfig = req['_tableConfig'] as TableConfig[''] || {};
        const id = checkSurrealResource(req.params['table']);
        let data = req.body;

        if (!Array.isArray(req.body)) {
            if (typeof tableConfig.beforePost == "function")
                data = await tableConfig.beforePost(data);

            let [result] = await db.create(id + ":ulid()", data);
            if (typeof tableConfig.afterPost == "function")
                result = await tableConfig.afterPost(result);

            res.send(result);
        }
        else {
            if (typeof tableConfig.beforePost == "function")
                data = await Promise.all(data.map(d => tableConfig.beforePost(d)));

            let result = await Promise.all(
                data.map((item) => db.create(id + ":ulid()", item))
            );

            if (typeof tableConfig.afterPost == "function")
                result = await Promise.all(result.map(r => tableConfig.afterPost(r)));

            res.send(result.filter(r => r !== undefined));
        }
    }));

    router.put('/:table', route(async (req, res, next) => {
        const tableConfig = req['_tableConfig'] as TableConfig[''] || {};
        const id = checkSurrealResource(req.params['table']);
        let data = req.body;

        if (!Array.isArray(req.body)) {

            if (typeof tableConfig.beforePut == "function")
                data = await tableConfig.beforePut(data);

            if (data.id != id) {
                throw { message: "payload id does not match id in uri", status: 400 }
            }

            let [result] = await db.update(data.id, data);

            if (typeof tableConfig.afterPut == "function")
                result = await tableConfig.afterPut(result);

            res.send(result);
        }
        else {
            if (typeof tableConfig.beforePut == "function")
                data = await Promise.all(data.map(d => tableConfig.beforePut(d)));

            let result = await Promise.all(
                data.map((item) => db.update(item.id, item))
            );

            if (typeof tableConfig.afterPut == "function")
                result = await Promise.all(result.map(r => tableConfig.afterPut(r)));

            res.send(result.filter(r => r !== undefined));
        }
    }));

    router.patch('/:table', route(async (req, res, next) => {
        const tableConfig = req['_tableConfig'] as TableConfig[''] || {};
        const id = checkSurrealResource(req.params['table']);
        let data = req.body;

        if (!Array.isArray(req.body)) {
            if (typeof tableConfig.beforePatch == "function")
                data = await tableConfig.beforePatch(data);

            // Allow for partial object patches
            // if (data.id != id) {
            //     throw { message: "payload id does not match id in uri", status: 400 };
            // }

            let [result] = await db.merge(id, data);

            if (typeof tableConfig.afterPatch == "function")
                result = await tableConfig.afterPatch(result);

            res.send(result);
        }
        else {
            if (typeof tableConfig.beforePatch == "function")
                data = await Promise.all(data.map(d => tableConfig.beforePatch(d)));

            let result = await Promise.all(
                data.map((item) => db.merge(item.id, item))
            );

            if (typeof tableConfig.afterPatch == "function")
                result = await Promise.all(result.map(r => tableConfig.afterPatch(r)));

            res.send(result.filter(r => r !== undefined));
        }
    }));

    router.delete('/:table', route(async (req, res, next) => {
        const tableConfig = req['_tableConfig'] as TableConfig[''] || {};
        const id = checkSurrealResource(req.params['table']);
        let data = req.body;

        if (!Array.isArray(req.body)) {
            let [result] = await db.delete(id);

            res.send(result);
        }
        else {
            if (typeof tableConfig.beforeDelete == "function")
                data = await Promise.all(data.map(d => tableConfig.beforeDelete(d)));

            let result = await Promise.all(
                data.map((item) => db.delete(item.id))
            );

            if (typeof tableConfig.afterDelete == "function")
                result = await Promise.all(result.map(r => tableConfig.afterDelete(r)));

            res.send(result.filter(r => r !== undefined));
        }
    }));

    return router;
};
