import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { PipelineDefinition } from '../types/pipeline';
import { GetAllRunningJobs } from '../util/kube';
import { RunPipeline } from '../util/pipeline';

const router = express.Router();

router.get('/', route(async (req, res, next) => {

    const getReleases = !!req.query['release'] || !!req.query['releases'];

    const [
        kubeJobs,
        [pipelines],
        [jobs]
    ] = await Promise.all([
        GetAllRunningJobs(),
        getReleases
            ? db.query("select * from pipeline where _isUserEditInstance != true and kind = 'release'")
            : db.query("select * from pipeline where _isUserEditInstance != true and kind = 'build'"),
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

// Endpoint for a user to manually trigger a pipeline
router.get('/:id/start', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];

    // Get an array of stage ids from query params
    const stageIds = (Array.isArray(req.query['stage'])
        ? req.query['stage'] as string[]
        : [req.query['stage']] as string[])
        .filter(r => !!r);

    // Resolve the matching stages, ignore the others.
    const stages = stageIds.length == 0
        ? pipeline.stages
        : pipeline.stages?.filter(s => stageIds.includes(s.id));

    await RunPipeline(pipeline, req.session.gh_user.login, stages);

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
