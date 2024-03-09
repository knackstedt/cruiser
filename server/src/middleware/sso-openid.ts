import * as express from "express";
import dotenv from 'dotenv';
import axios from 'axios';
import { randomString, route } from '../util/util';

dotenv.config({
    path: process.cwd() + '/../.env'
});

const router = express.Router();

const providers = {
    "gh": {
        clientId: process.env['GITHUB_OAUTH_CLIENTID'],
        clientSecret: process.env['GITHUB_OAUTH_SECRET'],
    }
}

router.use("/login", (req, res, next) => {
    req.session._state = randomString(128);
    const url = "https://github.com/login/oauth/authorize" +
        "?client_id=" + providers.gh.clientId +
        "&state=" + req.session._state;

    req.session.save(err => {
        err
            ? next(err)
            : res.redirect(url)
    })
});

router.use("/logout", (req, res, next) => {
    req.session.destroy(err => {
        err
            ? next(err)
            : res.redirect('/')
    })
});


router.use("/code", route(async (req, res, next) => {
    const requestToken = req.query.code;

    // Prevent sign-in hijacking.
    if (req.session._state != req.query.state)
        return next(401);

    const url = `https://github.com/login/oauth/access_token` +
        `?client_id=${providers.gh.clientId}` +
        `&client_secret=${providers.gh.clientSecret}` +
        `&code=${requestToken}`;

    const { data: token } = await axios({ method: "POST", url, headers: { accept: 'application/json' } });


    const url2 = `https://api.github.com/user`;
    const { data: user } = await axios.get(url2, { headers: {
        accept: 'application/vnd.github+json',
        Authorization: "Bearer " + token.access_token,
        "X-GitHub-Api-Version": "2022-11-28"
    } });

    req.session.regenerate(err => {
        if (err) return next(err);

        req.session.gh_user = user;
        req.session.gh_access_token = token.access_token;
        req.session.gh_scope = token.scope;
        req.session.gh_token_type = token.token_type;

        res.redirect('/');
    })
}));

export const OpenIDHandler = router;
