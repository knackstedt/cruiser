import * as express from "express";
import proxy from 'express-http-proxy';
import * as k8s from '@kubernetes/client-node';

import { route } from '../util/util';
import { db } from '../util/db';
import { JobInstance } from '../../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const router = express.Router();

router.use('/:id', route(async (req, res, next) => {

    const id = req.params['id'];

    const [{ result: job }] = await db.query<JobInstance[]>(`SELECT * FROM jobs:${id}`);

    if (!job)
        return next(404);

    const { body: pod } = await k8sApi.readNamespacedPod(job.kubePodName, job.kubeNamespace)

    const ip = pod.status.podIP;
    if (!ip)
        return next(404);

    const prox = proxy(`http://${ip}:8080`, {
        reqAsBuffer: true,
        reqBodyEncoding: null,
        parseReqBody: false,
        preserveHostHdr: false,
        limit: '50mb'
    });
    prox(req, res, next);
}));

export const TunnelApi = router;
