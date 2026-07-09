const { getAuth } = require('@clerk/express');
const { sendError } = require('../utils/response');

function csv(value) {
    return (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function getRequestAuth(req) {
    if (req.auth && typeof req.auth !== 'function') {
        return req.auth;
    }

    try {
        return getAuth(req);
    } catch {
        return null;
    }
}

function requireAuthenticatedUser(req, res, next) {
    const auth = getRequestAuth(req);

    if (!auth?.isAuthenticated || !auth.userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    req.user = {
        id: auth.userId,
        sessionId: auth.sessionId || null,
        orgId: auth.orgId || null,
        orgRole: auth.orgRole || null,
        orgPermissions: auth.orgPermissions || []
    };

    return next();
}

function configuredAdminUserIds() {
    return new Set(csv(process.env.CLERK_ADMIN_USER_IDS));
}

function configuredAdminOrgRoles() {
    const roles = csv(process.env.CLERK_ADMIN_ORG_ROLES);
    return new Set(roles.length > 0 ? roles : ['org:admin', 'admin']);
}

function configuredAdminPermissions() {
    return new Set(csv(process.env.CLERK_ADMIN_ORG_PERMISSIONS));
}

function hasAnyAllowedValue(actualValues, allowedValues) {
    return actualValues.some((value) => allowedValues.has(value));
}

function isAdmin(auth) {
    if (!auth?.isAuthenticated || !auth.userId) {
        return false;
    }

    if (configuredAdminUserIds().has(auth.userId)) {
        return true;
    }

    const allowedRoles = configuredAdminOrgRoles();
    if (auth.orgRole && allowedRoles.has(auth.orgRole)) {
        return true;
    }

    const allowedPermissions = configuredAdminPermissions();
    if (allowedPermissions.size === 0) {
        return false;
    }

    const permissions = Array.isArray(auth.orgPermissions)
        ? auth.orgPermissions
        : [];

    return hasAnyAllowedValue(permissions, allowedPermissions);
}

function requireAdmin(req, res, next) {
    const auth = getRequestAuth(req);

    if (!auth?.isAuthenticated || !auth.userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!isAdmin(auth)) {
        return sendError(res, 403, 'FORBIDDEN', 'Admin access required');
    }

    req.user = {
        id: auth.userId,
        sessionId: auth.sessionId || null,
        orgId: auth.orgId || null,
        orgRole: auth.orgRole || null,
        orgPermissions: auth.orgPermissions || []
    };

    return next();
}

module.exports = {
    getRequestAuth,
    isAdmin,
    requireAdmin,
    requireAuthenticatedUser
};
