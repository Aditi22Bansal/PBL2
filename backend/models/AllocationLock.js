const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

// A per-organization mutex for room-set-rewriting operations (allocation
// runs, CSV syncs - both delete and recreate RoomAllocation documents).
// Without this, two overlapping runs each snapshot the pre-run rooms, each
// concludes every student is newly placed, and each writes its own
// notification - the exact "3 notifications for 2 rooms" incident this was
// built to prevent.
//
// DB-backed (not in-memory) so it holds across backend instances. Atomicity
// comes from the unique index on organizationId: exactly one inserter wins,
// the loser gets E11000. Expiry is enforced in the acquire query itself
// (expiresAt < now counts as free), so a crashed run can never wedge the org
// forever even if the TTL monitor hasn't swept yet.
const allocationLockSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, default: SIT_PUNE_ORG_ID },
  lockedAt: { type: Date, required: true, default: Date.now },
  // Runs take minutes (large batches); the proxy also allows 10 minutes.
  // 20 minutes bounds a wedged lock while never expiring a live run.
  expiresAt: { type: Date, required: true },
  actorEmail: { type: String, required: true },
}, { timestamps: false });

// Belt-and-braces sweep for locks whose owner died without releasing.
// The acquire query treats expired locks as free regardless of this index.
allocationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AllocationLock', allocationLockSchema);
