
/**
 * Ensure the authenticated user has at least one of the specified roles
 * in order to access the endpoint.
 */
export const RoleGuard = (roles: string[]) => (req, res, next) => {
    // If we're being accessed via an agent then we'll bypass the user auth flow.
    const hasAccess = req['_agentToken'] ||
    // Check if the user has any of the required roles
    roles.find(r => req.session.profile.roles.includes(r));

    hasAccess ? next()
        : next(401);
}

export const AdministratorRoleGuard = RoleGuard(['administrator'])

const ManagerRoleGuard = RoleGuard(['administrator', 'manager'])
const User = RoleGuard(['administrator', 'manager', 'user'])
const Guest = RoleGuard(['administrator', 'manager', 'guest'])

export const EndpointGuard = (req, res, next) => {
    // Agents get to bypass the auth checks
    if (req['_agentToken']) {
        return next();
    }
    if (!req.session.profile) {
        return next(401);
    }

    // If a session has the lockout property, that means their access is now revoked or
    // they have no roles to access the application with.
    if (req.session.lockout) {
        return res.send({ lockedOut: true });
    }

    // If the request is a get, allow guests to execute it.
    // TODO: authn should be more strict and configurable
    if (req.method == "get") {
        Guest(req, res, next);
    }
    else {
        User(req, res, next);
    }
}
