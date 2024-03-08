import * as express from "express";
import { route } from '../util/util';


const router = express.Router();

// GET a secret will never return a secret
router.get('/', route(async (req, res, next) => {
    req.session.gh_user
        ? res.send(req.session.gh_user)
        : next(401)
}));

export const UserApi = router;
