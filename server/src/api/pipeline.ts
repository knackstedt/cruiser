import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { PipelineDefinition, PipelineInstance, PipelineStage } from '../types/pipeline';
// import { GetAllRunningJobs } from '../util/kube';
import { RunPipeline, RunStage } from '../util/pipeline';
import { JobInstance } from '../types/agent-task';
import { StringRecordId } from 'surrealdb';

const router = express.Router();

router.get('/', route(async (req, res, next) => {

    const getReleases = !!req.query['release'] || !!req.query['releases'];

    const [
        // kubeJobs,
        [pipelines],
        // [jobs]
    ] = await Promise.all([
        // GetAllRunningJobs(),
        getReleases
            // ? db.query("select * from pipeline where _isUserEditInstance != true and kind = 'release'")
            ? db.query("select * from pipeline where _isUserEditInstance != true")
            // : db.query("select * from pipeline where _isUserEditInstance != true and kind = 'build'"),
            : db.query("select * from pipeline where _isUserEditInstance != true"),
        // db.query("select * from jobs where latest = true")
    ]);

    res.send(pipelines);
    // res.send({
    //     pipelines,
    //     jobs,
    //     // kubeJobs
    // });
}));

router.use('/:id', route(async (req, res, next) => {
    const pipeline = await db.select<PipelineDefinition>(new StringRecordId(req.params['id']));
    if (!pipeline) throw { message: "Pipeline does not exist", status: 404 };

    if (!Array.isArray(pipeline.stages)) {
        return next({
            status: 422,
            message: "Pipeline has no stages to run"
        });
    }

    req['pipeline'] = pipeline;

    next();
}));

// Endpoint for a user to manually trigger a pipeline
router.get('/:id/run', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];

    // Get an array of stage ids from query params
    const stageIds = (Array.isArray(req.query['stage'])
        ? req.query['stage'] as string[]
        : [req.query['stage']] as string[])
        .filter(r => !!r);

    // Resolve the matching stages, ignore the others.
    const stages = stageIds.length == 0
        ? pipeline.stages.filter(s => !s.stageTrigger || s.stageTrigger.length == 0)
        : pipeline.stages.filter(s => stageIds.includes(s.id));

    const results = await RunPipeline(pipeline, req.session.gh_user.login, stages);

    res.send({
        message: "ok",
        pipeline,
        results
    });
}));

router.get('/:id/:instance/:stage/run', route(async (req, res, next) => {
    const pipeline = await db.select<PipelineDefinition>(new StringRecordId(req.params['id']));
    const instance = await db.select<PipelineInstance>(new StringRecordId(req.params['instance']));
    const stage = pipeline?.stages?.find(s => s.id == req.params['stage']);

    if (instance.spec.id != pipeline.id || !stage)
        throw { status: 400, message: "Pipeline / Instance mismatch. Please make sure the pipeline instance is an instance of the specified pipeline" };

    instance.status.phase = "waiting";
    // Remove all of the job instances for the stage that's being re-run
    instance.status.jobInstances = (instance.status.jobInstances as any as JobInstance[]).filter(ji => ji.stage != stage.id) as any;

    const result = await RunStage(instance, stage);

    res.send(result);
}));

router.get('/:id/:instance/:stage/approve', route(async (req, res, next) => {
    const pipeline: PipelineDefinition = req['pipeline'];

    const forceRun = !!req.query['forceRun'];
    const instance = await db.select<PipelineInstance>(new StringRecordId(req.params['instance']));
    const stage = instance?.spec?.stages?.find(s => s.id == req.params['stage']);

    if (!stage) return next(404);

    // Find the approval for this specific stage
    // If one can't be found, the system is not in the right state
    // to perform an approval.
    const approval = instance.status.stageApprovals.find(sa => sa.stageId == stage.id);
    if (!approval) return next(428);

    // TODO: How do we want to handle this?
    if (approval.hasRun) {
        return next(425);
    }
    approval.approvalCount++;
    approval.approvers.push(req.session.gh_user.login);

    // Update the approvals
    await db.merge(new StringRecordId(instance.id), instance);

    if (forceRun) {
        // User is forcing the run, log it.
    }
    // Run the stage if we have sufficient approvals.
    if (forceRun || approval.approvalCount >= stage.requiredApprovals) {
        approval.hasRun = true;
        await db.merge(new StringRecordId(instance.id), instance);
        const state = await RunStage(instance, stage);
        res.send({
            message: "ok",
            pipeline,
            state
        });
    }
    else {
        res.send({
            message: "ok",
            pipeline
        });
    }
}));

export const PipelineApi = router;
