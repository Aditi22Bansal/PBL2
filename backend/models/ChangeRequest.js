const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const changeRequestSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  studentId: { type: String, required: true }, // Identifier
  studentName: { type: String },
  currentRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomAllocation', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
