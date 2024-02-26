import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { JobDefinition, PipelineDefinition, StageDefinition, TaskDefinition, TaskGroupDefinition } from '../../types/pipeline';
import { StartAgent } from '../util/kube';
import { checkSurrealResource } from './database-controller';


const router = express.Router();

const getPipeline = async id => {
    if (id.includes(':'))
        id = id.split(':').pop();

    const [result] = await db.query<PipelineDefinition[]>(`SELECT * FROM pipelines:${id}`);
    return result[0];
}

const createPipeline = async (pipeline: PipelineDefinition, stashId = false, replace = false) => {
    // Wipe out any fields that are somehow null
    pipeline.stages = pipeline.stages.filter(s => s !== null);

    if (replace) {
        // If we're replacing an old pipeline, destroy all of the inherited properties
        // TODO: Don't do this -- properly deal with the changes >.>
        const stages: StageDefinition[] = pipeline.stages;
        const jobs: JobDefinition[] = stages.map(s => s.jobs).flat();
        const taskGroups: TaskGroupDefinition[] = jobs.map(j => j.taskGroups).flat();
        const tasks: TaskDefinition[] = taskGroups.map(t => t.tasks).flat();

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

    await db.merge(pipeline.id, pipeline.stats);

    await StartAgent(pipeline, stage);

    res.send({ message: "ok" });
}));

router.get('/:id/freeze', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];


    res.send({ message: "ok" });
}));

export const PipelineApi = router;
