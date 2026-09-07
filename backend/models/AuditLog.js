const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

// Append-only record of admin actions. Same org-scoping pattern as every other
// collection - an org's audit log is exactly as isolated as its actual data.
const auditLogSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  actorEmail: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: {
    type: String,
    required: true,
    enum: [
      'ROOM_LOCK_TOGGLE',
      'TRIGGER_ALLOCATION',
      'CSV_SYNC',
      'CHANGE_REQUEST_ACTION',
      'MANUAL_SWAP',
      'ACCOMMODATE_REQUEST',
      'HOSTEL_CONFIG_CREATE',
      'HOSTEL_CONFIG_UPDATE',
      'HOSTEL_CONFIG_ACTIVATE',
      'ORG_REGISTRATION',
    ],
  },
  // The _id of whatever the action was performed on (a room, a request, a config,
  // the org itself) - a plain string, not a typed ref, since it points at different
  // collections depending on the action and this is a read-only historical record,
  // never joined/populated. Null for actions with no single target (e.g. trigger-allocation).
  targetId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  // `timestamps: true` below gives every document a real `createdAt` - that IS this
  // model's "timestamp" field, not a separate redundant one.
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
