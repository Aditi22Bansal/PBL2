const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const roomAllocationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  allocation_run_id: { type: String, required: true, index: true },
  gender_group: { type: String },
  compatibility_score: { type: Number },
  members: [{ type: String, index: true }], // Array of Emails or user_ids
  room_number: { type: String },
  room_capacity: { type: Number },
  block: { type: String },
  floor: { type: Number },
  isLocked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);
