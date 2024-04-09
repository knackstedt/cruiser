import * as express from "express";
import { route } from './util';
import {environment} from '../util/environment';
import { api } from '../util/axios';

const router = express.Router();

// Stops the agent. Sets interrupted on the job instance
router.post('/stop', route(async (req, res, next) => {
    await api.patch(`/api/odata/${environment.jobInstanceId}`, { state: "building", buildEpoch: Date.now() })

}));

export const AgentApi = router;
