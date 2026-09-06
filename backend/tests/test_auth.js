// Permanent regression tests for the real authentication vulnerability documented in
// SECURITY.md #1 (admin routes with zero authentication) and the identity-spoofing
// class of bug it belonged to (dashboard/chat/change-request trusting client-supplied
// body/query fields instead of the server-derived, trusted identity).
const request = require('supertest');
const { app } = require('../server');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const { registerOrg, syncUser } = require('./fixtures');

beforeAll(async () => {
  await connect();
}, 60000);

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('admin route authentication (requireAuth + requireAdmin)', () => {
  test('no credentials on an admin route -> 401', async () => {
    const res = await request(app).get('/api/admin/allocations');
    expect(res.status).toBe(401);
  });

  test('valid non-admin (student) credentials on an admin route -> 403', async () => {
    await registerOrg(app, {
      orgName: 'Auth Test Org',
      domain: 'authtest1.edu',
      founderName: 'Founder',
      founderEmail: 'founder@authtest1.edu',
    });
    await syncUser(app, { email: 'student@authtest1.edu', name: 'Student' });

    const res = await request(app)
      .get('/api/admin/allocations')
      .set('X-User-Email', 'student@authtest1.edu');

    expect(res.status).toBe(403);
  });

  test('valid admin credentials -> 200', async () => {
    await registerOrg(app, {
      orgName: 'Auth Test Org 2',
      domain: 'authtest2.edu',
      founderName: 'Founder',
      founderEmail: 'admin@authtest2.edu',
    });

    const res = await request(app)
      .get('/api/admin/allocations')
      .set('X-User-Email', 'admin@authtest2.edu');

    expect(res.status).toBe(200);
  });
});

describe('identity comes only from the trusted header, never body/query (mirrors the original student_54/student_96 exploit)', () => {
  test("a student's own dashboard is returned regardless of a forged identity in the query string", async () => {
    await registerOrg(app, {
      orgName: 'Isolation Org',
      domain: 'isoauth.edu',
      founderName: 'Founder',
      founderEmail: 'founder@isoauth.edu',
    });
    await syncUser(app, { email: 'alice@isoauth.edu', name: 'Alice' });
    await syncUser(app, { email: 'bob@isoauth.edu', name: 'Bob' });

    // Distinguishable draft profiles - saveProfile doesn't require every schema
    // field to succeed (no runValidators on this upsert), a name is enough.
    await request(app).put('/api/student/profile').set('X-User-Email', 'alice@isoauth.edu').send({ name: 'Alice' });
    await request(app).put('/api/student/profile').set('X-User-Email', 'bob@isoauth.edu').send({ name: 'Bob' });

    // Alice's real header, but a forged/decoy identity in the query string - if
    // the handler ever fell back to reading identity from req.query instead of
    // req.currentUser (the historical bug class), this would return Bob's data.
    const res = await request(app)
      .get('/api/student/dashboard?email=bob@isoauth.edu&user_id=bob@isoauth.edu')
      .set('X-User-Email', 'alice@isoauth.edu');

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('Alice');
  });
});
