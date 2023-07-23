import * as express from "express";
import { route } from '../util';
import { db } from '../db';
import { Pipeline, PipelineJob, PipelineStage, PipelineTask, PipelineTaskGroup } from '../../types/pipeline';
import { StartAgent } from '../kube';
import { checkSurrealResource } from './database-controller';


const router = express.Router();

const getPipeline = async id => {
    const [{ result }] = await db.query(`SELECT * FROM pipeline:${id} FETCH stages, stages.jobs, stages.jobs.taskGroups, stages.jobs.taskGroups.tasks`);
    const [pipeline] = result as Pipeline[];
    return pipeline;
}

const createPipeline = async (pipeline: Pipeline) => {
    // This is possibly the worst thing I could have done.
    pipeline.stages = await Promise.all(pipeline.stages.map(async s => {
        s.jobs = await Promise.all(s.jobs.map(async j => {
            j.taskGroups = await Promise.all(j.taskGroups.map(async tg => {
                tg.tasks = await Promise.all(tg.tasks.map(t => {
                    delete t.id;
                    return db.create('pipelineTask:ulid()', t).then(([r]) => r.id as any) as any;
                }));
                delete tg.id;
                return db.create('pipelineTaskGroup:ulid()', tg).then(([r]) => r.id as any) as any;
            }));
            delete j.id;
            return db.create('pipelineJob:ulid()', j).then(([r]) => r.id) as any;
        }));
        delete s.id;
        return db.create('pipelineStage:ulid()', s).then(([r]) => r.id) as any;
    }));

    delete pipeline.id;
    const part = (await db.create(`pipeline:ulid()`, pipeline))[0];
    return await getPipeline(part.id.split(':')[1]);
}

router.use('/:id', route(async (req, res, next) => {
    const [table, id] = checkSurrealResource(req.params['id']).split(':');

    const pipeline = await getPipeline(id);

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

/**
 * General CRUD actions
 */
router.get('/:id', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];
    res.send(pipeline);
}));

router.get('/:id/editclone', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    pipeline.isUserEditInstance = true;

    res.send(await createPipeline(pipeline));
}));


// Perform a deep create of a pipeline
router.post('/', route(async (req, res, next) => {
    const pipeline: Pipeline = req.body;
    const version = req.query['version'];

    res.send(await createPipeline(pipeline));
}));


// Perform a deep merge of a pipeline UHHH
router.patch('/:id', route(async (req, res, next) => {
    const pipelineA: Pipeline = req['pipeline'];
    const pipelineB: Pipeline = req.body;

    const version = req.query['version'];

    // // This is possibly the worst thing I could have done.
    // await Promise.all(pipelineB.stages.map(async s => {




    //     s.jobs = await Promise.all(s.jobs.map(async j => {
    //         j.taskGroups = await Promise.all(j.taskGroups.map(async tg => {
    //             tg.tasks = await Promise.all(tg.tasks.map(t => {
    //                 // delete t.id;
    //                 return db.merge(t).then(([r]) => r.id as any) as any;
    //             }));
    //             // delete tg.id;
    //             return db.merge('pipelineTaskGroup:ulid()', tg).then(([r]) => r.id as any) as any;
    //         }));
    //         // delete j.id;
    //         return db.merge('pipelineJob:ulid()', j).then(([r]) => r.id) as any;
    //     }));

    //     // delete s.id;
    //     return db.merge('pipelineStage:ulid()', s).then(([r]) => r.id) as any;
    // }));
    // // delete pipeline.id;
    // (await db.merge(`pipeline:ulid()`, pipelineA))[0];


    const newPipeline = await getPipeline(pipelineA.id.split(':')[1]);
    res.send(newPipeline);
}));

// Perform a deep delete of a pipeline
router.delete('/:id', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    const stages: PipelineStage[] = pipeline.stages;
    const jobs: PipelineJob[] = stages.map(s => s.jobs).flat();
    const taskGroups: PipelineTaskGroup[] = jobs.map(j => j.taskGroups).flat();
    const tasks: PipelineTask[] = taskGroups.map(t => t.tasks).flat();

    const ids = [
        pipeline.id,
        ...stages.map(s => s.id),
        ...jobs.map(s => s.id),
        ...taskGroups.map(s => s.id),
        ...tasks.map(s => s.id)
    ];

    res.send(await Promise.all(ids.map(id => db.delete(id))));
}));

export const PipelineApi = router;
