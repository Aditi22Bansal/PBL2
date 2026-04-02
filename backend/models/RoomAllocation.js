const mongoose = require('mongoose');

const roomAllocationSchema = new mongoose.Schema({
  allocation_run_id: { type: String, required: true },
  gender_group: { type: String },
  compatibility_score: { type: Number },
  members: [{ type: String }], // Array of Emails or user_ids
  room_number: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);
