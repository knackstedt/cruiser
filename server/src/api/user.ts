import * as express from "express";
import { route } from '../util/util';
import { CruiserUserProfile } from '../types/cruiser-types';
import { AdministratorRoleGuard } from '../guards/role-guards';
import { db } from '../util/db';

const router = express.Router();

// Get user.
router.get('/', route(async (req, res, next) => {
    req.session.profile
        ? res.send({
            profile: req.session.profile,
            userConfiguration: {
                defaultWorkspace: "default",
                workspaces: ["default"]
            },
            systemConfiguration: {
                // List of enabled features / screens
                features: [""],

                // Can the UI change configuration options
                enableUIConfiguration: true,
            }
        })
        : next(401)
}));

// Guard access to the rest of this router.
router.use(AdministratorRoleGuard);

router.post('/add', route(async (req, res, next) => {
    const rolesToAdd = req.body.roles as string[];
    const targetUserId = req.body.userId as string;

    const [profile] = await db.create("users:ulid()", {
        login: targetUserId,
        roles: rolesToAdd || []
    } as CruiserUserProfile);

    res.send({ profile });
}));

router.post('/grant-role/:id', route(async (req, res, next) => {
    const id = req.params['id'];

    if (!id.startsWith('users:'))
        return next(404);

    const role = req.body.role as string;

    let [profile] = await db.select<CruiserUserProfile>(id);

    // Prevent duplicate role additions
    if (profile.roles.includes(role as any)) {
        res.send({ profile });
        return;
    }

    profile.roles.push(role as any);

    [profile] = await db.merge(id, {
        roles: profile.roles
    } as CruiserUserProfile);

    res.send({ profile });
}));

router.post('/revoke-role/:id', route(async (req, res, next) => {
    const id = req.params['id'];

    if (!id.startsWith('users:'))
        return next(404);

    const role = req.body.role as string;

    let [profile] = await db.select<CruiserUserProfile>(id);

    // If the role isn't there, we'll do nothing.
    if (!profile.roles.includes(role as any)) {
        res.send({ profile });
        return;
    }

    profile.roles.splice(profile.roles.indexOf(role as any), 1);

    [profile] = await db.merge(id, {
        roles: profile.roles
    } as CruiserUserProfile);

    res.send({ profile });
}));

router.delete('/:id', route(async (req, res, next) => {
    const id = req.params['id'];

    if (!id.startsWith('users:'))
        return next(404);

    const [ item ] = await db.delete(id);

    res.send({ success: !!item });
}));


export const UserApi = router;
