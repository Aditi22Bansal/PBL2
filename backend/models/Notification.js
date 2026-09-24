const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const notificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  recipient_email: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['ROOM_ALLOCATED'] },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  // True when this notification was retired by a newer one for the same
  // student (re-run re-placed them, or a CSV sync wiped the rooms it
  // referenced). Superseded notifications never surface as unread - a
  // student only ever sees their latest placement. Set by
  // supersedeStaleNotifications, never by clients.
  superseded: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
