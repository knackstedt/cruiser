import * as express from "express";
import fs from 'fs-extra';
import { route } from '../util/util';
import { db } from '../util/db';
import { logger } from '../util/logger';
import { Decrypt, Encrypt, KeyGen } from '../util/crypt';
import { environment } from '../util/environment';

const router = express.Router();

// TODO: Add some additional security scope to the GET enpoint.
router.get('/:scope/:key', route(async (req, res, next) => {
    const { scope, key } = req.params;

    const [ secret ] = await db.query(
        `select * from secrets where scope = '${scope}' and key = '${key}'`
    ) as any;

    if (!secret) return next(404);

    const { encryptionKey } = await fs.readJson(
        environment.vault_storage_path + "/" + secret.id
    );

    res.send({ value: Decrypt(secret.data, encryptionKey) });
}));

router.post('/:scope/:key', route(async (req, res, next) => {
    const { scope, key } = req.params;

    const encryptionKey = KeyGen();
    const enc = Encrypt(req.body.value, encryptionKey);
    db.create("secrets:ulid()", {
        scope,
        key,
        value: enc,
        created_by: req.session.profile.id,
        created_on: Date.now()
    })
    .then(async ([result]) => {
        await fs.mkdirp(environment.vault_storage_path + "/");
        await fs.writeJson(
            environment.vault_storage_path + "/" + result.id,
            { encryptionKey }
        );

        res.send({ id: result.id });
    })
    .catch(err => {
        logger.error(err);
        res.send({ message: "failed" })
    });
}));

router.delete('/:scope/:key', route(async (req, res, next) => {
    const { scope, key } = req.params;

    const sql = `select * from secrets where scope = '${scope}' and key = '${key}'`;
    const [[secret]] = await db.query(sql) as any;

    await fs.remove(environment.vault_storage_path + "/" + secret.id);

    res.send(await db.delete(secret.id));
}));

export const VaultApi = router;
