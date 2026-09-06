const AuditLog = require('../models/AuditLog');

// Fire-and-forget by design: swallows its own errors internally (same failure-
// isolation principle as triggerAllocation's notification step, see
// adminController.js) so a logging failure can NEVER block or fail the actual
// admin action it's recording. Call sites never need their own try/catch around
// this - awaiting it just orders the write, it never rejects.
async function logAuditEvent({ organizationId, actorEmail, actorRole, action, targetId = null, metadata = {} }) {
    try {
        await AuditLog.create({ organizationId, actorEmail, actorRole, action, targetId, metadata });
    } catch (err) {
        console.error(`[auditLog] Failed to record "${action}" for ${actorEmail}:`, err.message);
    }
}

module.exports = { logAuditEvent };
