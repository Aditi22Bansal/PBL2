const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const roomAllocationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  allocation_run_id: { type: String, required: true, index: true },
  gender_group: { type: String },
  compatibility_score: { type: Number },
  members: [{ type: String, index: true }], // Array of Emails or user_ids
  // NOT unique. A `room_number_1` unique+sparse index existed in the live DB
  // from an earlier schema version (undeclared here, orphaned) and was dropped
  // - it blocked re-running allocation against a populated DB, since the
  // deterministic per-run room numbering (adminController.js) always collides
  // with the previous run's still-present rooms. Global uniqueness was wrong
  // anyway for multi-tenancy; the correct constraint is a scoped
  // organizationId+room_number compound unique index, to be added as part of
  // the tenant-scoping work (see docs/multi-tenant-design.md) - not added yet.
  room_number: { type: String },
  room_capacity: { type: Number },
  block: { type: String },
  floor: { type: Number },
  isLocked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);
