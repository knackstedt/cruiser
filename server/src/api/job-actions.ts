import * as k8s from '@kubernetes/client-node';
import * as express from "express";
import { route } from '../util/util';
import { db } from '../util/db';
import { checkSurrealResource } from './database-controller';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.BatchV1Api);

const router = express.Router();

router.use('/:id', route(async (req, res, next) => {
    const [table, id] = checkSurrealResource(req.params['id']).split(':');

    const job = await db.query<any[]>(`SELECT * FROM job_instance:${id}`);

    if (!job) throw { message: "Job does not exist", status: 404 };

    req['job'] = job;

    next();
}));

router.get('/:id/pause', route(async (req, res, next) => {
    const job = req['job'];

    await k8sApi.patchNamespacedJob(job.kube_pod, job.kube.namespace, {

    });

    res.send({ message: "ok" });
}));

router.get('/:id/environment', route(async (req, res, next) => {
    const job = req['job'];


    res.send({ key: "value" });
}));

router.get('/:id/cancel', route(async (req, res, next) => {
    const job = req['job'];

    await k8sApi.deleteNamespacedJob(job.kube_pod, job.kube.namespace);

    res.send({ message: "ok" });
}));

export const JobActionsApi = router;
