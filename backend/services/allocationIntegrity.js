// Allocation integrity helpers: the per-org run lock, notification
// superseding, and placement verification behind the allocation endpoints.
// Pure logic lives here (unit-testable); controllers only wire it in.
const AllocationLock = require('../models/AllocationLock');
const Notification = require('../models/Notification');

// How long a run may hold the lock before it is considered crashed and
// stealable. comfortably above the longest real run (minutes) and the
// 10-minute proxy timeout, far below "wedged forever".
const LOCK_TTL_MS = 20 * 60 * 1000;

/**
 * Atomically acquire the allocation lock for an org. Returns true when this
 * caller now owns the lock, false when another live run holds it.
 */
async function acquireAllocationLock(organizationId, actorEmail) {
  const now = new Date();
  // Fast path: a live (unexpired) lock already exists - someone is running.
  const existing = await AllocationLock.findOne({ organizationId }).lean();
  if (existing && existing.expiresAt > now) return false;
  if (existing) {
    // Stale lock from a crashed run: take it over only if nobody else just
    // did. The expiresAt condition makes concurrent takeovers safe - exactly
    // one updater can match a given stale document.
    const tookOver = await AllocationLock.updateOne(
      { _id: existing._id, expiresAt: existing.expiresAt },
      { $set: { lockedAt: now, expiresAt: new Date(now.getTime() + LOCK_TTL_MS), actorEmail } }
    );
    return tookOver.modifiedCount === 1;
  }
  // No lock document: insert. Concurrent inserters race on the unique index;
  // E11000 means we lost, which is the correct answer (not an error).
  try {
    await AllocationLock.create({
      organizationId,
      lockedAt: now,
      expiresAt: new Date(now.getTime() + LOCK_TTL_MS),
      actorEmail,
    });
    return true;
  } catch (err) {
    if (err && err.code === 11000) return false;
    throw err;
  }
}

async function releaseAllocationLock(organizationId) {
  await AllocationLock.deleteOne({ organizationId });
}

async function isAllocationLocked(organizationId) {
  const existing = await AllocationLock.findOne({ organizationId }).lean();
  return !!existing && existing.expiresAt > new Date();
}

/**
 * Retire stale unread ROOM_ALLOCATED notifications.
 *
 * Default (retireAll=false): keep only the newest unread per recipient -
 * collapses stacks so a student only ever sees their latest placement.
 * Call this AFTER inserting the replacement notifications, so the just
 * created ones are the newest and survive.
 *
 * retireAll=true: retire every matching unread notification, keeping none.
 * For flows that invalidate all current placements (CSV sync wipes every
 * unlocked room), where even the newest unread references a dead room.
 *
 * Returns { recipientsFixed, superseded }. Idempotent.
 */
async function supersedeStaleNotifications(organizationId, onlyEmails, options) {
  const retireAll = !!(options && options.retireAll);
  const filter = { organizationId, type: 'ROOM_ALLOCATED', read: false };
  if (onlyEmails && onlyEmails.length > 0) {
    filter.recipient_email = { $in: onlyEmails };
  }
  // _id order, not createdAt: ObjectIds are strictly monotonic, so the
  // newest document always sorts first even for same-millisecond inserts.
  const unread = await Notification.find(filter).sort({ _id: -1 }).lean();
  const seen = new Set();
  const staleIds = [];
  for (const n of unread) {
    if (retireAll || seen.has(n.recipient_email)) {
      staleIds.push(n._id);
    } else {
      seen.add(n.recipient_email);
    }
  }
  let superseded = 0;
  if (staleIds.length > 0) {
    const res = await Notification.updateMany(
      { _id: { $in: staleIds } },
      { $set: { read: true, superseded: true } }
    );
    superseded = res.modifiedCount || 0;
  }
  return { recipientsFixed: seen.size, superseded };
}

/**
 * Pure: find emails placed in more than one room.
 * Returns [{ email, rooms: [room_number, ...] }].
 */
function findDuplicatePlacements(rooms) {
  const byEmail = new Map();
  for (const r of rooms || []) {
    for (const m of r.members || []) {
      if (!byEmail.has(m)) byEmail.set(m, []);
      byEmail.get(m).push(r.room_number || String(r._id));
    }
  }
  const dups = [];
  for (const [email, roomList] of byEmail) {
    if (roomList.length > 1) dups.push({ email, rooms: roomList });
  }
  return dups;
}

/**
 * Fail-closed integrity check on a freshly computed allocation, BEFORE
 * anything is written. Throws on: the same email in two new rooms, or an
 * email that is both locked in place and re-placed by the new run.
 */
function assertPlacementIntegrity(newAllocations, lockedEmails) {
  const locked = new Set(lockedEmails || []);
  const seen = new Set();
  for (const alloc of newAllocations || []) {
    for (const email of alloc.members || []) {
      if (locked.has(email)) {
        throw new Error(`Integrity violation: ${email} is locked in place but also re-placed by this run. Aborting before touching data.`);
      }
      if (seen.has(email)) {
        throw new Error(`Integrity violation: ${email} placed in more than one new room. Aborting before touching data.`);
      }
      seen.add(email);
    }
  }
}

module.exports = {
  LOCK_TTL_MS,
  acquireAllocationLock,
  releaseAllocationLock,
  isAllocationLocked,
  supersedeStaleNotifications,
  findDuplicatePlacements,
  assertPlacementIntegrity,
};
