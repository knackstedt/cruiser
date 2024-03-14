import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { PipelineDefinition } from '../types/pipeline';
import { GetAllRunningJobs, StartAgent } from '../util/kube';

const router = express.Router();

router.get('/', route(async (req, res, next) => {

    const [
        kubeJobs,
        [pipelines],
        [jobs]
    ] = await Promise.all([
        GetAllRunningJobs(),
        db.query("select * from pipelines where isUserEditInstance != true"),
        db.query("select * from jobs where latest = true")
    ]);

    res.send({
        pipelines,
        jobs,
        kubeJobs
    });
}));

router.use('/:id', route(async (req, res, next) => {
    const [ pipeline ] = await db.select(req.params['id']);

    if (!pipeline) throw { message: "Pipeline does not exist", status: 404 };

    req['pipeline'] = pipeline;

    next();
}));

router.get('/:id/start', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];

    const stage = pipeline.stages?.[0];
    if (!stage) {
        res.status(409);
        res.send({ message: "Cannot start: pipeline doesn't have any stages to run." });
        return;
    }
    if (stage.jobs?.length < 1) {
        res.status(409);
        res.send({ message: "Cannot start: pipeline stage doesn't have any jobs to run." });
        return;
    }

    pipeline.stats = pipeline.stats || {
        runCount: 0,
        successCount: 0,
        failCount: 0,
        totalRuntime: 0
    };

    pipeline.stats.runCount += 1;

    pipeline.lastScheduledEpoch = Date.now();
    pipeline.lastScheduledBy = req.session.gh_user.login;

    await db.merge(pipeline.id, {
        stats: pipeline.stats,
        lastScheduledEpoch: pipeline.lastScheduledEpoch,
        lastScheduledBy: pipeline.lastScheduledBy
    });

    await StartAgent(pipeline, stage);

    res.send({
        message: "ok",
        pipeline
    });
}));

router.get('/:id/freeze', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];


    res.send({ message: "ok" });
}));

export const PipelineApi = router;
