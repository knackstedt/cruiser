import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import execa from "execa";

const router = express.Router();

router.get('/', route(async (req, res, next) => {
    db.query(`SELECT * from array::flatten((select sources from pipelines where isUserEditInstance != true or isUserEditInstance = null).sources)`)
        .then(([data]) => res.send(data))
        .catch(err => next(err));
}));

export const GetGitRefs = async(remote: string) => {
    // TODO: investigate how costly this execution is.
    const { stdout } = await execa("git", ["ls-remote", remote]);

    const obj: { hash: string, id: string }[] = [];

    stdout.split('\n').forEach(line => {
        const [hash, id] = line.split(/\s+/);
        obj.push({ hash, id });
    });
    return obj;
}

router.get('/branches', (req, res, next) => {
    GetGitRefs(req.query['remote'] ?? req.body.remote)
        .then(refs =>
            refs
                .filter(r => r.id[5] == "h") // Cheapest CPU check
                .map(r => r.id.slice(11))    // Cheapest way to crop string
        )
        .then(data => res.send(data))
        .catch(err => next(err));
});

router.get('/tags', (req, res, next) => {
    GetGitRefs(req.query['remote'] ?? req.body.remote)
        .then(refs =>
            refs
                .filter(r => r.id[5] == "t") // Cheapest CPU check
                .map(r => r.id.slice(10))    // Cheapest way to crop string
        )
        .then(data => res.send(data))
        .catch(err => next(err));
});

router.get('/remotes', (req, res, next) => {
    GetGitRefs(req.query['remote'] ?? req.body.remote)
        .then(refs => res.send(refs))
        .catch(err => next(err));
});


export const SourcesApi = router;
