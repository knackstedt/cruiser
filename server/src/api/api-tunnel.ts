import * as express from "express";
import proxy from 'express-http-proxy';
import * as k8s from '@kubernetes/client-node';

import { route } from '../util/util';
import { db } from '../util/db';
import { JobInstance } from '../types/agent-task';
import axios from 'axios';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

const router = express.Router();

const podCache: { [key: string]: k8s.V1Pod } = {};

const loadIntoCache = async (uid: string, jobId: string, job) => {
    if (!podCache[uid]) {
        const { body: pods } = await k8sApi.listNamespacedPod(job.kubeNamespace);

        podCache[uid] = pods.items.find(i =>
            i.metadata?.annotations?.['Job_Id'] == jobId
        );
    }
    const pod = podCache[uid];

    const ip = pod.status.podIP;
    if (!ip) {
        throw {
            status: 425,
            message: "Agent is not running"
        }
    }

    return ip;
}

const tryLoadCache = async (uid: string, jobId: string, job) => {
    // Caching mechanism so that we can persist the IP addresses without constant
    // lookups
    let ip = await loadIntoCache(uid, jobId, job);

    let url = `http://${ip.replace(/\./g, '-')}.${job.kubeNamespace}.pod.cluster.local:8080`;

    let isOk = await axios.get(url + '/ping')
        .then(r => true)
        .catch(e => false);

    if (isOk) {
        return url;
    }

    delete podCache[uid];

    ip = await loadIntoCache(uid, jobId, job);
    url = `http://${ip.replace(/\./g, '-')}.${job.kubeNamespace}.pod.cluster.local:8080`;

    // Test if we got a new one
    isOk = await axios.get(url + '/ping')
        .then(r => true)
        .catch(e => false);

    if (isOk) {
        return url;
    }
    else {
        throw {
            status: 421,
            message: "Agent is unreachable"
        }
    }
}

router.use('/:id', route(async (req, res, next) => {

    const id = req.params['id'];

    const [{ result: jobs }] = await db.query<JobInstance[][]>(`SELECT * FROM ${id}`);
    const [ job ] = jobs;

    if (!job)
        return next(404);

    const uid = job['jobUid'];
    const jobId = job.id.split(':')[1];

    const url = await tryLoadCache(uid, jobId, job);

    const prox = proxy(url, {
        reqAsBuffer: true,
        reqBodyEncoding: null,
        preserveHostHdr: false,
        limit: '50mb',
        proxyReqOptDecorator(proxyReqOpts, srcReq) {
            proxyReqOpts.headers['X-Cruiser-Token'] = job['kubeAuthnToken'];
            return proxyReqOpts;
        },
        userResDecorator(proxyRes, proxyResData, userReq, userRes) {
            return proxyResData;
        },
        userResHeaderDecorator: (headers) => {
            headers['X-Cruiser-Target'] = job.id;
            return headers;
        },
    });
    prox(req, res, next);
}));

export const TunnelApi = router;
