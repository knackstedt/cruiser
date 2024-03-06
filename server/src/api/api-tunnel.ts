import * as express from "express";
import proxy from 'express-http-proxy';
import * as k8s from '@kubernetes/client-node';

import { route } from '../util/util';
import { db } from '../util/db';
import { JobInstance } from '../../types/agent-task';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

const router = express.Router();

const podCache: { [key: string]: k8s.V1Pod } = {};

router.use('/:id', route(async (req, res, next) => {

    const id = req.params['id'];

    const [{ result: jobs }] = await db.query<JobInstance[][]>(`SELECT * FROM ${id}`);
    const [ job ] = jobs;

    if (!job)
        return next(404);

    const uid = job['jobUid'];
    const jobId = job.id.split(':')[1];

    // Caching mechanism so that we can persist the IP addresses without constant
    // lookups
    if (!podCache[uid]) {
        const { body: pods } = await k8sApi.listNamespacedPod(job.kubeNamespace);

        podCache[uid] = pods.items.find(i =>
            i.metadata?.annotations?.['Job_Id'] == jobId
        );
    }
    const pod = podCache[uid];

    const ip = pod.status.podIP;
    if (!ip)
        return next(404);

    const prox = proxy(`http://${ip.replace(/\./g, '-')}.${job.kubeNamespace}.pod.cluster.local:8080`, {
        reqAsBuffer: true,
        reqBodyEncoding: null,
        parseReqBody: false,
        preserveHostHdr: false,
        limit: '50mb',
        proxyReqOptDecorator(proxyReqOpts, srcReq) {
            proxyReqOpts.headers['Authorization'] = job['kubeAuthnToken'];
            return proxyReqOpts;
        },
    });
    prox(req, res, next);
}));

export const TunnelApi = router;
