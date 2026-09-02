const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const userSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  studentId: { type: String, unique: true, sparse: true },
  isFormSubmitted: { type: Boolean, default: false },
  role: { type: String, default: 'STU' },
  avatarUrl: { type: String },
});

module.exports = mongoose.model('User', userSchema);
