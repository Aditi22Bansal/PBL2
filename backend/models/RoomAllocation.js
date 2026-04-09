const mongoose = require('mongoose');

const roomAllocationSchema = new mongoose.Schema({
  allocation_run_id: { type: String, required: true },
  gender_group: { type: String },
  compatibility_score: { type: Number },
  members: [{ type: String }], // Array of Emails or user_ids
  block: { type: String },
  floor: { type: Number },
  room_number: { type: String },
  isLocked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);
