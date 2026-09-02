const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String },
  slug: { type: String, unique: true },
  allowedEmailDomains: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
