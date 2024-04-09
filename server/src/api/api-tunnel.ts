import * as express from "express";
import proxy from 'express-http-proxy';
import * as k8s from '@kubernetes/client-node';

import { route } from '../util/util';
import { db } from '../util/db';
import { JobInstance } from '../types/agent-task';
import axios from 'axios';
import { logger } from '../util/logger';
import { environment } from '../util/environment';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

const router = express.Router();

const podCache: { [key: string]: k8s.V1Pod } = {};

const loadIntoCache = async (uid: string, jobId: string, namespace: string) => {
    if (!podCache[uid]) {
        const { body: pods } = await k8sApi.listNamespacedPod(namespace);

        const pod = pods.items.find(i =>
            i.metadata?.annotations?.['cruiser.dev/job-id'] == jobId
        );
        //
        if (pod?.status?.podIP) {
            podCache[uid] = pod;
        }
        else {
            throw {
                status: 425,
                message: "Agent is not running"
            }
        }
    }

    const pod = podCache[uid];
    const ip = pod.status.podIP;

    return ip;
}

export const getPodEndpointUrl = async (jobKubeUid: string, jobId: string, namespace: string) => {
    // Caching mechanism so that we can persist the IP addresses without constant
    // lookups
    let ip = await loadIntoCache(jobKubeUid, jobId, namespace);

    let url = `http://${ip.replace(/\./g, '-')}.${namespace}.pod.cluster.local:8080`;

    let isOk = await axios.get(url + '/ping')
        .then(r => true)
        .catch(e => {
            logger.warn(e);
            return false;
        });

    if (isOk) {
        return url;
    }

    delete podCache[jobKubeUid];

    ip = await loadIntoCache(jobKubeUid, jobId, namespace);
    url = `http://${ip.replace(/\./g, '-')}.${namespace}.pod.cluster.local:8080`;

    // Test if we got a new one
    isOk = await axios.get(url + '/ping')
        .then(r => true)
        .catch(e => e);

    if (isOk === true) {
        return url;
    }
    else {
        throw {
            status: 421,
            message: "Agent is unreachable",
            error: isOk
        }
    }
}

router.use('/:id', route(async (req, res, next) => {

    const id = req.params['id'];

    const [ jobs ] = await db.query<JobInstance[][]>(`SELECT * FROM ${id}`);
    const [ job ] = jobs;

    if (!job)
        return next(404);

    const uid = job['jobUid'];
    const jobId = job.id.split(':')[1];

    const url = await getPodEndpointUrl(uid, jobId, job.kubeNamespace ?? environment.cruiser_kube_namespace);

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
