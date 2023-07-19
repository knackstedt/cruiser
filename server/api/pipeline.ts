import * as express from "express";
import { route } from '../util';
import { db } from '../db';
import { Pipeline } from '../../types/pipeline';
import { StartAgent } from '../kube';
import { checkSurrealResource } from './database-controller';


const router = express.Router();

router.use('/:id', route(async (req, res, next) => {
    const [table, id] = checkSurrealResource(req.params['id']).split(':');
    const [{result}] = await db.query(`SELECT * FROM pipeline:${id} FETCH stages, stages.jobs, stages.jobs.taskGroups, stages.jobs.taskGroups.tasks`);
    const [pipeline] = result as any;

    if (!pipeline) throw { message: "Pipeline does not exist", status: 404 };

    req['pipeline'] = pipeline;

    next();
}));

router.get('/:id/start', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    const stage = pipeline.stages[0];

    await StartAgent(stage);

    res.send({ message: "ok" });
}));

router.get('/:id/pause', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];


    res.send({ message: "ok" });
}));

router.get('/:id/resume', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    res.send({ message: "ok" });
}));


router.get('/:id/freeze', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];


    res.send({ message: "ok" });
}));

router.get('/:id', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];
    res.send(pipeline);
}));

export const PipelineApi = router;
