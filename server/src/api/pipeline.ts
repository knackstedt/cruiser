import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { Pipeline, PipelineJob, PipelineStage, PipelineTask, PipelineTaskGroup } from '../../types/pipeline';
import { StartAgent } from '../util/kube';
import { checkSurrealResource } from './database-controller';


const router = express.Router();

const getPipeline = async id => {
    if (id.includes(':'))
        id = id.split(':').pop();

    const [{ result }] = await db.query(`SELECT * FROM pipeline:${id} FETCH stages, stages.jobs, stages.jobs.taskGroups, stages.jobs.taskGroups.tasks`);
    const [pipeline] = result as Pipeline[];
    return pipeline;
}

const createPipeline = async (pipeline: Pipeline, stashId = false, replace = false) => {
    // Wipe out any fields that are somehow null
    pipeline.stages = pipeline.stages.filter(s => s !== null);

    if (replace) {
        // If we're replacing an old pipeline, destroy all of the inherited properties
        // TODO: Don't do this -- properly deal with the changes >.>
        const stages: PipelineStage[] = pipeline.stages;
        const jobs: PipelineJob[] = stages.map(s => s.jobs).flat();
        const taskGroups: PipelineTaskGroup[] = jobs.map(j => j.taskGroups).flat();
        const tasks: PipelineTask[] = taskGroups.map(t => t.tasks).flat();

        const ids = [
            ...stages.map(s => s.id),
            ...jobs.map(s => s.id),
            ...taskGroups.map(s => s.id),
            ...tasks.map(s => s.id)
        ];

        await Promise.all(ids.map(id => db.delete(id)));
    }

    // This is possibly the worst thing I could have done.
    pipeline.stages = await Promise.all(pipeline.stages?.map(async s => {

        s.jobs = await Promise.all(s.jobs.map(async j => {

            j.taskGroups = await Promise.all(j.taskGroups?.map(async tg => {

                tg.tasks = await Promise.all(tg.tasks?.map(t => {

                    if (stashId) t['_id'] = t.id;
                    delete t.id;
                    return db.create('pipelineTask:ulid()', t).then(([r]) => r.id as any) as any;
                }) || []);

                if (stashId) tg['_id'] = tg.id;
                delete tg.id;
                return db.create('pipelineTaskGroup:ulid()', tg).then(([r]) => r.id as any) as any;
            }) || []);

            if (stashId) j['_id'] = j.id;
            delete j.id;
            return db.create('pipelineJob:ulid()', j).then(([r]) => r.id) as any;
        }) || []);

        if (stashId) s['_id'] = s.id;
        delete s.id;
        return db.create('pipelineStage:ulid()', s).then(([r]) => r.id) as any;
    }) || []);

    if (stashId) pipeline['_id'] = pipeline.id;

    if (replace) {
        await db.update(pipeline.id, pipeline);
        return await getPipeline(pipeline.id);
    }
    else {
        delete pipeline.id;
        const part = (await db.create(`pipeline:ulid()`, pipeline))[0];
        return await getPipeline(part.id);
    }
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

    await StartAgent(pipeline, stage);

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

// TODO: need to janitor old edit clones
router.get('/:id/editclone', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];

    pipeline.isUserEditInstance = true;

    res.send(await createPipeline(pipeline, true));
}));

/**
 * Apply a clone onto an existing pipeline
 */
router.post('/:id/applyclone', route(async (req, res, next) => {
    const pipeline: Pipeline = req['pipeline'];
    const clone: Pipeline = req.body;

    const data = JSON.stringify(pipeline);
    const payload = {
        objectRef: pipeline.id,
        data,
        // changedBy,
        changeType: "update",
        comment: "none"
    };

    const [ historyItem ] = await db.create(`objectHistory:ulid()`, payload);
    pipeline.history = pipeline.history || [];
    pipeline.history.push(historyItem.id as any);

    // Delete the old pipeline properties
    {
        const stages: PipelineStage[] = pipeline.stages.filter(s => s !== null);
        const jobs: PipelineJob[] = stages?.map(s => s.jobs).flat().filter(s => s !== null);
        const taskGroups: PipelineTaskGroup[] = jobs?.map(j => j.taskGroups).flat().filter(s => s !== null);
        const tasks: PipelineTask[] = taskGroups?.map(t => t.tasks).flat().filter(s => s !== null);

        const ids = [
            ...(stages?.map(s => s.id) || []),
            ...(jobs?.map(s => s.id) || []),
            ...(taskGroups?.map(s => s.id) || []),
            ...(tasks?.map(s => s.id) || [])
        ];

        await Promise.all(ids.map(id => db.delete(id)));
    }

    clone.id = pipeline.id;
    clone.isUserEditInstance = false;
    clone['_id'] = null;

    res.send(await createPipeline(clone, false, true));
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
