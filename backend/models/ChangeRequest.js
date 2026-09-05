const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const changeRequestSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  studentId: { type: String, required: true }, // Identifier
  studentName: { type: String },
  currentRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomAllocation', required: true },
  // Free-text supplementary note - optional now that requestType/
  // requestedAccommodation carry the actual structured request; a student can
  // still add context, but prose is no longer what the request TYPE hinges on.
  reason: { type: String, default: '' },
  // GENERAL keeps today's behavior exactly (admin reviews + manually swaps via
  // the Allocations panel). ACCESSIBILITY is structured: requestedAccommodation
  // names what's being asked for (e.g. "Ground floor") so the admin UI can
  // suggest eligible target rooms on approval instead of a free-text guess.
  requestType: { type: String, enum: ['GENERAL', 'ACCESSIBILITY'], default: 'GENERAL' },
  requestedAccommodation: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
