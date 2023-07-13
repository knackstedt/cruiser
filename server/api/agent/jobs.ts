import * as express from "express";
import { route } from '../../util';
import { db } from '../../db';


const router = express.Router();

/**
 * Set the status of a running job
 */
router.get('/:jobid/state', route(async (req, res, next) => {
    db.merge(`${req.params['jobid']}`, { state: req.query['state'] })
    res.send({ message: "ok" });
}));

/**
 * Read files
 */
router.post('/:jobid/error', route(async (req, res, next) => {

}));


router.use('/:jobid', route(async (req, res, next) => {

}));

/**
 * Export a number of API routes that are needed for the main portal UI.
 */
export const FilesystemApi = router;
