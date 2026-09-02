const mongoose = require('mongoose');

// Fixed at migration time (see backend/scripts/migrate-add-organization.js) so the
// schema-level `default` used across every model and the actual Organization
// document the migration inserts always agree on the same _id.
const SIT_PUNE_ORG_ID = new mongoose.Types.ObjectId('6a9848222e7587dd132841fc');

module.exports = { SIT_PUNE_ORG_ID };
