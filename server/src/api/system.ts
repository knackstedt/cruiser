import * as express from "express";
import { route } from '../util/util';
import { environment } from '../util/environment';
import { CruiserSettings } from '../types/cruiser-settings';
import { AdministratorRoleGuard } from '../guards/role-guards';
import { db } from '../util/db';

const router = express.Router();

router.use(AdministratorRoleGuard);

/**
 * Return a list of all mutable and immutable configuration properties on the system.
 */
router.get('/settings', route(async (req, res, next) => {
    const env = process.env;
    const environmentVars = Object.entries(env).map(([key, value]) => ({ key, value, immutable: true }));

    const settings = await db.select<CruiserSettings['settings'][0]>(`system-settings`);

    res.send({
        environmentVars,
        settings
    })
}));

/**
 * Create or update a setting. Will not apply a value if the setting is immutable.
 */
router.post('/setting', route(async (req, res, next) => {

}));

export const SystemApi = router;
