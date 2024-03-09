import * as express from "express";
import { afterDatabaseConnected, db } from '../util/db';
import { logger } from '../util/logger';

afterDatabaseConnected(() => {
    // Always ensure that the root administrator exists on startup.
    db.create("user_gh:" + process.env['CRUISER_ADMINISTRATOR'] ?? 'root', {
        roles: ['administrator']
    })
    .catch(err => {
        logger.fatal({
            msg: "Failed to create administrator account!",
            err
        });
    });
})

export const UserAccessHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    db.select("user_gh:" + req.session.gh_user.login)
        .then(([record]) => {
            req.roles = record?.['roles'] ?? [] as any;
            next();
        })
        .catch(err => next(err))
}
