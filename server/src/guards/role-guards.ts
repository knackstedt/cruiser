
const Administrator = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator")
        ? next()
        : next(401);
}

const Manager = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager")
        ? next()
        : next(401);
}

const User = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager") ||
    req.session.profile.roles.includes("user")
        ? next()
        : next(401);
}

const Guest = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager") ||
    req.session.profile.roles.includes("user") ||
    req.session.profile.roles.includes("guest")
        ? next()
        : next(401);
}


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
