import * as express from "express";
import { route } from '../util';
import { db } from '../db';


const router = express.Router();

// GET a secret will never return a secret
router.get('/:id', route(async (req, res, next) => {
    const [table, id] = req.params['id'].split(':');

    if (!/^[0-7][0-9A-F]{25}$/.test(id))
        throw 400;


    const [{result}] = await db.query(`SELECT * FROM secret:${id}`);
    const [secret] = result as any;

    if (!secret) throw { message: "Secret does not exist", status: 404 };

    res.send("<masked>");
}));

router.post('/', route(async (req, res, next) => {
    (await db.create("secret:ulid()", req.body))[0];

    res.send({ message: "ok" });
}));

export const SecretsApi = router;
