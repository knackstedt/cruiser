
export const Administrator = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator")
        ? next()
        : next(401);
}

export const Manager = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager")
        ? next()
        : next(401);
}

export const User = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager") ||
    req.session.profile.roles.includes("user")
        ? next()
        : next(401);
}

export const Guest = (req, res, next) => {
    req['_agentToken'] ||
    req.session.profile.roles.includes("administrator") ||
    req.session.profile.roles.includes("manager") ||
    req.session.profile.roles.includes("user") ||
    req.session.profile.roles.includes("guest")
        ? next()
        : next(401);
}
