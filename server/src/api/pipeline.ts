import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { PipelineDefinition } from '../types/pipeline';
import { GetAllRunningJobs } from '../util/kube';
import { RunPipeline } from '../util/pipeline';

const router = express.Router();

router.get('/', route(async (req, res, next) => {

    const [
        kubeJobs,
        [pipelines],
        [jobs]
    ] = await Promise.all([
        GetAllRunningJobs(),
        db.query("select * from pipelines where _isUserEditInstance != true"),
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
    const stageIds = Array.isArray(req.query.stage) ? req.query.stage as string[] : [req.query.stage] as string[];

    // Resolve the matching stages, ignore the others.
    const stages = pipeline.stages.filter(s => stageIds.includes(s.id));

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
