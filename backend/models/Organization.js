const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String },
  slug: { type: String, unique: true },
  // unique: true on an array field creates a MongoDB multikey unique index -
  // no single domain string can appear in more than one org's array, at the
  // DB level (not just app-level convention). Without this, nothing stopped
  // two Organization documents from claiming the same domain, silently
  // hijacking sign-ups depending on which one a query happened to match first.
  allowedEmailDomains: { type: [String], unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
