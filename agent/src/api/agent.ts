import * as express from "express";
import { route } from './util';
import {environment} from '../util/environment';
import { api } from '../util/axios';
import { logger } from '../util/logger';

const router = express.Router();

// Stops the agent. Sets interrupted on the job instance
router.post('/stop', route(async (req, res, next) => {
    await api.patch(`/api/odata/${environment.jobInstanceId}`, {
            state: "cancelled",
            endEpoch: Date.now()
        }
    );

    // Not sure if this is sync...?
    res.send({message: "ok"});

    logger.warn({
        msg: "Task cancelled by user. Shutting down..."
    })

    // 5ms to allow res.send and logger.warn to flush
    setTimeout(() => {
        process.exit(0);
    }, 5)
}));

export const AgentApi = router;
