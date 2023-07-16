import * as express from "express";
import { route } from '../util';
import { db } from '../db';
import { Pipeline } from '../../types/pipeline';
import { StartAgent } from '../kube';


const router = express.Router();

router.use('/:id', route(async (req, res, next) => {
    const [table, id] = req.params['id'].split(':');
    const [pipeline] = await db.select(`pipeline:${id}`);

    if (!pipeline) throw { message: "Pipeline does not exist", status: 404 };

    req['pipeline'] = pipeline;

    next();
}));

router.get('/:id/start', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    const stage = pipeline.stages[0];

    await StartAgent(stage);

    res.send({ mesage: "ok" });
}));

router.get('/:id/pause', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];


    res.send({ mesage: "ok" });
}));

router.get('/:id/resume', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    res.send({ mesage: "ok" });
}));


router.get('/:id/freeze', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];


    res.send({ mesage: "ok" });
}));


export const PipelineApi = router;