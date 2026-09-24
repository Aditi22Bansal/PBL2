// Permanent regression tests for the "3 notifications for 2 rooms" incident:
// overlapping allocation runs (and CSV-sync-wipes-rooms cycles) each concluded
// every student was newly placed, stacking one ROOM_ALLOCATED notification per
// run with different room numbers. The fix under test:
//   1. a per-org DB-backed run lock (second concurrent run/sync -> 429),
//   2. superseding of older unread notifications on re-placement and on sync,
//   3. fail-closed placement integrity (one student, one room) + health report,
//   4. a repair endpoint collapsing pre-existing stacks.
const request = require('supertest');

jest.mock('../services/allocationService', () => {
  const actual = jest.requireActual('../services/allocationService');
  return { ...actual, runPythonAllocation: jest.fn() };
});

const { app } = require('../server');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const { registerOrg } = require('./fixtures');
const { runPythonAllocation } = require('../services/allocationService');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const Notification = require('../models/Notification');
const {
  acquireAllocationLock,
  releaseAllocationLock,
  assertPlacementIntegrity,
  findDuplicatePlacements,
} = require('../services/allocationIntegrity');

const ORG = {
  orgName: 'Integrity Org',
  domain: 'integrity.edu',
  founderName: 'Founder',
  founderEmail: 'admin@integrity.edu',
};
const ADMIN = 'admin@integrity.edu';
const STUDENTS = ['a@integrity.edu', 'b@integrity.edu', 'c@integrity.edu'];

async function seedProfiles(orgId) {
  await Profile.insertMany(STUDENTS.map((email, i) => ({
    organizationId: orgId,
    user_id: email,
    name: `Student ${i}`,
    profileCompleted: true,
  })));
}

function mockEngine(roomSuffix) {
  runPythonAllocation.mockResolvedValue({
    run_id: `run_${roomSuffix}_${Date.now()}`,
    allocations: [
      {
        members: [...STUDENTS],
        capacity: 3,
        gender_group: 'TEST',
        compatibility_score: 0.9,
      },
    ],
  });
}

async function orgIdOf(domain) {
  const Organization = require('../models/Organization');
  const org = await Organization.findOne({ allowedEmailDomains: domain }).lean();
  return org._id;
}

beforeAll(async () => {
  await connect();
}, 60000);

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

describe('allocation run lock', () => {
  test('a second run while one is in flight gets 429, the first completes', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    await seedProfiles(orgId);

    // Hold the engine call open so run #1 is provably mid-flight.
    let releaseEngine;
    const engineGate = new Promise((resolve) => { releaseEngine = resolve; });
    runPythonAllocation.mockImplementationOnce(() => engineGate.then(() => ({
      run_id: 'run_first',
      allocations: [{ members: [...STUDENTS], capacity: 3, gender_group: 'T', compatibility_score: 0.9 }],
    })));

    // NOTE: supertest only sends on .end()/.then() - a bare created request
    // never hits the server, so fire explicitly via .end(callback) to have
    // run #1 genuinely in flight before run #2 starts.
    const sendTrigger = () => new Promise((resolve) => {
      request(app).post('/api/admin/trigger-allocation').set('X-User-Email', ADMIN).send({}).end((err, res) => resolve(res));
    });
    const firstDone = sendTrigger();
    // Give the first request a turn to acquire the lock and enter the engine.
    await new Promise((r) => setTimeout(r, 500));
    const second = await sendTrigger();

    expect(second.status).toBe(429);
    releaseEngine();
    const firstRes = await firstDone;
    expect(firstRes.status).toBe(200);

    // Exactly one notification set exists - no stacking possible.
    const notifs = await Notification.find({ recipient_email: STUDENTS[0] }).lean();
    expect(notifs).toHaveLength(1);
  });

  test('lock is released after a run, so the next run proceeds', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    await seedProfiles(orgId);
    mockEngine('one');

    const first = await request(app).post('/api/admin/trigger-allocation').set('X-User-Email', ADMIN).send({});
    expect(first.status).toBe(200);
    mockEngine('two');
    const second = await request(app).post('/api/admin/trigger-allocation').set('X-User-Email', ADMIN).send({});
    // Sequential re-run: allowed, but nobody is newly placed, so nothing new.
    expect(second.status).toBe(200);
    const notifs = await Notification.find({ recipient_email: STUDENTS[0] }).lean();
    expect(notifs).toHaveLength(1);
  });

  test('room mutations are rejected with 409 while a run holds the lock', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    const acquired = await acquireAllocationLock(orgId, ADMIN);
    expect(acquired).toBe(true);

    const room = await RoomAllocation.create({
      organizationId: orgId,
      allocation_run_id: 'seed',
      members: [...STUDENTS],
      room_number: 'A-G01',
      room_capacity: 3,
    });

    const swap = await request(app).post('/api/admin/allocations/manual-swap')
      .set('X-User-Email', ADMIN)
      .send({ roomAId: room._id.toString(), memberA: STUDENTS[0], roomBId: room._id.toString(), memberB: STUDENTS[1] });
    expect(swap.status).toBe(409);

    const lock = await request(app).post('/api/admin/allocations/toggle-lock')
      .set('X-User-Email', ADMIN)
      .send({ roomId: room._id.toString(), isLocked: true });
    expect(lock.status).toBe(409);

    await releaseAllocationLock(orgId);
    const afterRelease = await request(app).post('/api/admin/allocations/toggle-lock')
      .set('X-User-Email', ADMIN)
      .send({ roomId: room._id.toString(), isLocked: true });
    expect(afterRelease.status).toBe(200);
  });
});

describe('notification superseding and repair', () => {
  test('re-placement retires the older unread notification (the incident scenario)', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    await seedProfiles(orgId);

    // Run 1 places everyone -> one notification each.
    mockEngine('one');
    await request(app).post('/api/admin/trigger-allocation').set('X-User-Email', ADMIN).send({});

    // Simulate the CSV-sync wipe from the incident: rooms gone, students
    // unallocated again, old notification still unread.
    await RoomAllocation.deleteMany({ organizationId: orgId });

    // Run 2 re-places them (possibly into a different room number).
    mockEngine('two');
    await request(app).post('/api/admin/trigger-allocation').set('X-User-Email', ADMIN).send({});

    const unread = await Notification.find({ recipient_email: STUDENTS[0], read: false }).lean();
    expect(unread).toHaveLength(1);
    const retired = await Notification.find({ recipient_email: STUDENTS[0], superseded: true }).lean();
    expect(retired).toHaveLength(1);
  });

  test('repair endpoint collapses a pre-existing stack, keeping the newest', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    const now = Date.now();
    await Notification.insertMany([
      { organizationId: orgId, recipient_email: STUDENTS[0], type: 'ROOM_ALLOCATED', message: 'room A-G01', createdAt: new Date(now - 3000) },
      { organizationId: orgId, recipient_email: STUDENTS[0], type: 'ROOM_ALLOCATED', message: 'room D-G2405', createdAt: new Date(now - 2000) },
      { organizationId: orgId, recipient_email: STUDENTS[0], type: 'ROOM_ALLOCATED', message: 'room A-G01 again', createdAt: new Date(now - 1000) },
    ]);

    const res = await request(app).post('/api/admin/repair-notifications').set('X-User-Email', ADMIN).send({});
    expect(res.status).toBe(200);
    expect(res.body.superseded).toBe(2);

    const unread = await Notification.find({ recipient_email: STUDENTS[0], read: false }).lean();
    expect(unread).toHaveLength(1);
    expect(unread[0].message).toBe('room A-G01 again');

    // Idempotent: a second run reports nothing to do.
    const again = await request(app).post('/api/admin/repair-notifications').set('X-User-Email', ADMIN).send({});
    expect(again.body.superseded).toBe(0);
  });

  test('repair is org-scoped: another org\u2019s stack is untouched', async () => {
    await registerOrg(app, ORG);
    await registerOrg(app, {
      orgName: 'Other Org',
      domain: 'other.edu',
      founderName: 'Founder',
      founderEmail: 'admin@other.edu',
    });
    const orgId = await orgIdOf(ORG.domain);
    const otherId = await orgIdOf('other.edu');
    await Notification.insertMany([
      { organizationId: orgId, recipient_email: STUDENTS[0], type: 'ROOM_ALLOCATED', message: 'old 1' },
      { organizationId: orgId, recipient_email: STUDENTS[0], type: 'ROOM_ALLOCATED', message: 'old 2' },
      { organizationId: otherId, recipient_email: 'x@other.edu', type: 'ROOM_ALLOCATED', message: 'other 1' },
      { organizationId: otherId, recipient_email: 'x@other.edu', type: 'ROOM_ALLOCATED', message: 'other 2' },
    ]);

    await request(app).post('/api/admin/repair-notifications').set('X-User-Email', ADMIN).send({});
    const otherUnread = await Notification.find({ organizationId: otherId, read: false }).lean();
    expect(otherUnread).toHaveLength(2);
  });
});

describe('placement integrity', () => {
  test('assertPlacementIntegrity throws on duplicates and locked overlap, passes clean', () => {
    expect(() =>
      assertPlacementIntegrity(
        [{ members: ['a@x.edu'] }, { members: ['a@x.edu'] }],
        []
      )
    ).toThrow(/more than one/);

    expect(() =>
      assertPlacementIntegrity([{ members: ['a@x.edu'] }], new Set(['a@x.edu']))
    ).toThrow(/locked/);

    expect(() =>
      assertPlacementIntegrity([{ members: ['a@x.edu'] }, { members: ['b@x.edu'] }], new Set(['c@x.edu']))
    ).not.toThrow();
  });

  test('health endpoint flags duplicate placements and profile-less members', async () => {
    await registerOrg(app, ORG);
    const orgId = await orgIdOf(ORG.domain);
    await seedProfiles(orgId);
    // The incident's wreckage shape: same student in two rooms.
    await RoomAllocation.insertMany([
      { organizationId: orgId, allocation_run_id: 'r1', members: [STUDENTS[0], STUDENTS[1]], room_number: 'A-G01', room_capacity: 3 },
      { organizationId: orgId, allocation_run_id: 'r2', members: [STUDENTS[0], 'ghost@integrity.edu'], room_number: 'D-G2405', room_capacity: 3 },
    ]);

    const res = await request(app).get('/api/admin/allocation-health').set('X-User-Email', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.healthy).toBe(false);
    expect(res.body.duplicatePlacements).toEqual([{ email: STUDENTS[0], rooms: ['A-G01', 'D-G2405'] }]);
    expect(res.body.membersWithoutProfile).toEqual(['ghost@integrity.edu']);
  });

  test('findDuplicatePlacements is empty for a clean room set', () => {
    expect(findDuplicatePlacements([
      { room_number: 'A-1', members: ['a@x.edu'] },
      { room_number: 'A-2', members: ['b@x.edu'] },
    ])).toEqual([]);
  });
});
