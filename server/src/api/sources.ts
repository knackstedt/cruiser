import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';

const router = express.Router();

router.get('/', route(async (req, res, next) => {
    db.query(`SELECT * from array::flatten((select sources from pipelines where isUserEditInstance != true or isUserEditInstance = null).sources)`)
        .then(([data]) => res.send(data.result))
        .catch(err => next(err));
}));


export const SourcesApi = router;
