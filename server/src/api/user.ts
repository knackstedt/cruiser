import * as express from "express";
import { route } from '../util/util';


const router = express.Router();

router.get('/', route(async (req, res, next) => {
    req.session.gh_user
        ? res.send(req.session.gh_user)
        : next(401)
}));

// router.post('/invite', route(async (req, res, next) => {

// }));

// router.post('/invite', route(async (req, res, next) => {
//     req.session.gh_user
//         ? res.send(req.session.gh_user)
//         : next(401)
// }));

export const UserApi = router;
