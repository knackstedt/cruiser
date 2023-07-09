import * as express from "express";
import { route } from '../../util';
import Surreal from 'surrealdb.js';

const db = new Surreal('http://127.0.0.1:8000/rpc');
(async () => {
    await db.signin({
        user: 'root',
        pass: 'root',
    });
    await db.use({ ns: '@dotglitch', db: 'dotops' });
})();

const router = express.Router();


// router.use(proxy('http://127.0.0.1:8000/rpc'));
/**
 * Scan the library and build the metadata database.
 */
router.get('/', route(async (req, res, next) => {
    res.send(await db.select("pipeline"));
}));

router.post('/', route(async (req, res, next) => {
    res.send(await db.create("pipeline:ulid()", {
        name: 'test pipeline 3',
        group: "default",
    }));
}));

router.use('/:pipeline', (req, res, next) => {
    const id = req.params.pipeline as string;
    if (!/^[A-Z0-9]{26}$/.test(id)) return next({ message: "Malformed identifier", status: 400 });
    next();
})

router.get('/:pipeline', route(async (req, res, next) => {
    res.send(await db.select(`pipeline:${req.params['pipeline']}`));
}));

router.put('/:pipeline', route(async (req, res, next) => {
    res.send(await db.update(`pipeline:${req.params['pipeline']}`, {
        name: 'pipeline 2',
    }));
}));

router.patch('/:pipeline', route(async (req, res, next) => {
    res.send(await db.merge(`pipeline:${req.params['pipeline']}`, {
        name: 'pipeline 3 -- patched',
    }));
}));

router.delete('/:pipeline', route(async (req, res, next) => {
    res.send(await db.delete(`pipeline:${req.params['pipeline']}`));
}));

export const PipelineApi = router;
