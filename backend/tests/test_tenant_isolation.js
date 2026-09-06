// Permanent regression tests for multi-tenant data isolation (SECURITY.md's
// "Multi-tenant data isolation" section): every controller query is scoped by the
// caller's own organizationId, and Organization.allowedEmailDomains has a real
// unique index - two orgs cannot claim the same domain.
const request = require('supertest');
const { app } = require('../server');
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

const validRoomTemplates = [{ capacity: 2, count: 1 }];

describe('cross-tenant isolation', () => {
  test("org A's admin never sees org B's rows on the list endpoint, and a direct-ID reference to org B's row 404s instead of leaking", async () => {
    const orgA = await registerOrg(app, {
      orgName: 'Org A', domain: 'tenant-a.edu', founderName: 'Admin A', founderEmail: 'admin@tenant-a.edu',
    });
    const orgB = await registerOrg(app, {
      orgName: 'Org B', domain: 'tenant-b.edu', founderName: 'Admin B', founderEmail: 'admin@tenant-b.edu',
    });
    expect(orgA.status).toBe(201);
    expect(orgB.status).toBe(201);

    const createA = await request(app)
      .post('/api/admin/hostel-configurations')
      .set('X-User-Email', 'admin@tenant-a.edu')
      .send({ hostelName: 'Org A Hostel', gender: 'Male', roomTemplates: validRoomTemplates });
    expect(createA.status).toBe(201);
    const orgAConfigId = createA.body._id;

    // Org B's admin lists configs - must be empty, not containing org A's row.
    const listB = await request(app)
      .get('/api/admin/hostel-configurations')
      .set('X-User-Email', 'admin@tenant-b.edu');
    expect(listB.status).toBe(200);
    expect(listB.body).toEqual([]);

    // Org B's admin references org A's REAL config _id directly - must 404, not leak it.
    const directB = await request(app)
      .get(`/api/admin/hostel-configurations/${orgAConfigId}`)
      .set('X-User-Email', 'admin@tenant-b.edu');
    expect(directB.status).toBe(404);

    // Sanity: org A's own admin can still see it via both paths.
    const listA = await request(app)
      .get('/api/admin/hostel-configurations')
      .set('X-User-Email', 'admin@tenant-a.edu');
    expect(listA.body.length).toBe(1);

    const directA = await request(app)
      .get(`/api/admin/hostel-configurations/${orgAConfigId}`)
      .set('X-User-Email', 'admin@tenant-a.edu');
    expect(directA.status).toBe(200);
  });

  test('duplicate domain registration is rejected (the real unique-index behavior)', async () => {
    const first = await registerOrg(app, {
      orgName: 'First Claimant', domain: 'contested.edu', founderName: 'Founder', founderEmail: 'founder@contested.edu',
    });
    expect(first.status).toBe(201);

    const second = await registerOrg(app, {
      orgName: 'Second Claimant', domain: 'contested.edu', founderName: 'Other Founder', founderEmail: 'other@contested.edu',
    });
    expect(second.status).toBe(409);
  });
});
