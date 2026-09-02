const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const chatSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomAllocation', required: true, index: true },
  sender_email: { type: String, required: true },
  sender_name: { type: String, required: true },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
