// Permanent regression tests for the NoSQL operator-injection hardening (SECURITY.md
// / docs/decisions.md): toggleRoomLock, handleRequestAction, and
// accommodateAccessibilityRequest used to validate ID fields with a bare truthy
// check (`!roomId`), which a crafted object like {"$ne": null} would pass straight
// through as a real Mongo query operator. Now validated with
// mongoose.Types.ObjectId.isValid() before ever reaching a query.
const request = require('supertest');
const { app } = require('../server');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const Organization = require('../models/Organization');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const { registerOrg } = require('./fixtures');

beforeAll(async () => {
  await connect();
}, 60000);

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

const INJECTION_PAYLOAD = { $ne: null };

describe('NoSQL injection hardening on ID fields', () => {
  let adminEmail;

  beforeEach(async () => {
    adminEmail = 'admin@injectiontest.edu';
    await registerOrg(app, {
      orgName: 'Injection Test Org', domain: 'injectiontest.edu', founderName: 'Admin', founderEmail: adminEmail,
    });
  });

  // Each test creates a real, unrelated "decoy" document the injection payload
  // could otherwise reach and mutate - proves the query itself was never
  // touched, not just that this org's collection happened to be empty (an
  // empty-collection "not found" would look identical from the status code
  // alone as a genuinely-rejected request).

  test('toggleRoomLock rejects an object-shaped roomId (400), never reaching the query', async () => {
    const org = await Organization.findOne({ allowedEmailDomains: 'injectiontest.edu' });
    const decoyRoom = await RoomAllocation.create({
      organizationId: org._id, allocation_run_id: 'run_decoy', members: ['x@injectiontest.edu'], isLocked: false,
    });

    const res = await request(app)
      .post('/api/admin/allocations/toggle-lock')
      .set('X-User-Email', adminEmail)
      .send({ roomId: INJECTION_PAYLOAD, isLocked: true });

    expect(res.status).toBe(400);

    const reread = await RoomAllocation.findById(decoyRoom._id);
    expect(reread.isLocked).toBe(false);
  });

  test('handleRequestAction rejects an object-shaped requestId (400), never reaching the query', async () => {
    const org = await Organization.findOne({ allowedEmailDomains: 'injectiontest.edu' });
    const decoyRoom = await RoomAllocation.create({
      organizationId: org._id, allocation_run_id: 'run_decoy', members: ['x@injectiontest.edu'],
    });
    const decoyRequest = await ChangeRequest.create({
      organizationId: org._id, studentId: 'x@injectiontest.edu', currentRoomId: decoyRoom._id, status: 'Pending',
    });

    const res = await request(app)
      .post('/api/admin/requests/action')
      .set('X-User-Email', adminEmail)
      .send({ requestId: INJECTION_PAYLOAD, status: 'Approved' });

    expect(res.status).toBe(400);

    const reread = await ChangeRequest.findById(decoyRequest._id);
    expect(reread.status).toBe('Pending');
  });

  test('accommodateAccessibilityRequest rejects an object-shaped requestId/targetRoomId (400), never reaching the query', async () => {
    const org = await Organization.findOne({ allowedEmailDomains: 'injectiontest.edu' });
    // Generous room_capacity (the real schema field - not "capacity") so _assertOpenSlot
    // never throws for an unrelated reason, regardless of whether the injected
    // targetRoomId resolves to this same room or not - isolates the assertion to
    // the actual validation gate, not an incidental capacity crash.
    const decoyRoom = await RoomAllocation.create({
      organizationId: org._id, allocation_run_id: 'run_decoy', members: ['x@injectiontest.edu'], room_capacity: 5,
    });
    const decoyRequest = await ChangeRequest.create({
      organizationId: org._id, studentId: 'x@injectiontest.edu', currentRoomId: decoyRoom._id,
      requestType: 'ACCESSIBILITY', status: 'Pending',
    });

    const res = await request(app)
      .post('/api/admin/requests/accommodate')
      .set('X-User-Email', adminEmail)
      .send({ requestId: INJECTION_PAYLOAD, targetRoomId: INJECTION_PAYLOAD });

    expect(res.status).toBe(400);

    const reread = await ChangeRequest.findById(decoyRequest._id);
    expect(reread.status).toBe('Pending');
  });
});
