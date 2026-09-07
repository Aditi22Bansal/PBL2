// Tests for the rate limiting, Helmet, and audit logging added alongside the
// existing security hardening (SECURITY.md).
const request = require('supertest');
const { app } = require('../server');
const AuditLog = require('../models/AuditLog');
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

describe('rate limiting on public auth endpoints', () => {
  test('sync-user is skipped under NODE_ENV=test - the suite itself never gets 429d', async () => {
    // Already implicitly proven by every other test file in this suite (dozens of
    // sync-user calls across the whole run, well past the real limit of 60), but
    // asserted directly here too.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/sync-user').send({ email: `ratelimitcheck${i}@nowhere.edu` });
      expect(res.status).not.toBe(429);
    }
  });

  test('the real limiter genuinely 429s past the configured threshold (verified by briefly leaving NODE_ENV=test)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      let sawTooManyRequests = false;
      // Limit is 60/15min - safely past that, and this uses the same in-memory
      // store express-rate-limit defaults to, keyed by IP, which supertest's
      // internal requests all share.
      for (let i = 0; i < 65; i++) {
        const res = await request(app).post('/api/auth/sync-user').send({ email: `ratelimitreal${i}@nowhere.edu` });
        if (res.status === 429) {
          sawTooManyRequests = true;
          break;
        }
      }
      expect(sawTooManyRequests).toBe(true);
    } finally {
      process.env.NODE_ENV = original;
    }
  }, 30000);
});

describe('Helmet security headers', () => {
  test('a real response includes Helmet\'s security headers and no longer advertises the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('admin action audit logging', () => {
  test('a real admin action produces exactly one correct audit entry', async () => {
    await registerOrg(app, {
      orgName: 'Audit Org', domain: 'audittest.edu', founderName: 'Admin', founderEmail: 'admin@audittest.edu',
    });

    const res = await request(app)
      .post('/api/admin/hostel-configurations')
      .set('X-User-Email', 'admin@audittest.edu')
      .send({ hostelName: 'Test Hostel', gender: 'Male', roomTemplates: [{ capacity: 2, count: 1 }] });
    expect(res.status).toBe(201);

    const entries = await AuditLog.find({ action: 'HOSTEL_CONFIG_CREATE' }).lean();
    expect(entries.length).toBe(1);
    expect(entries[0].actorEmail).toBe('admin@audittest.edu');
    expect(entries[0].actorRole).toBe('ADMIN');
    expect(entries[0].targetId).toBe(res.body._id.toString());
  });

  test("a second org's audit log stays completely isolated", async () => {
    await registerOrg(app, {
      orgName: 'Audit Org A', domain: 'auditisoa.edu', founderName: 'Admin A', founderEmail: 'admin@auditisoa.edu',
    });
    await registerOrg(app, {
      orgName: 'Audit Org B', domain: 'auditisob.edu', founderName: 'Admin B', founderEmail: 'admin@auditisob.edu',
    });

    await request(app)
      .post('/api/admin/hostel-configurations')
      .set('X-User-Email', 'admin@auditisoa.edu')
      .send({ hostelName: 'Org A Hostel', gender: 'Male', roomTemplates: [{ capacity: 2, count: 1 }] });

    const logB = await request(app).get('/api/admin/audit-log').set('X-User-Email', 'admin@auditisob.edu');
    expect(logB.status).toBe(200);
    // Only org B's own registration - nothing from org A's hostel-config creation.
    expect(logB.body.total).toBe(1);
    expect(logB.body.entries[0].action).toBe('ORG_REGISTRATION');
  });

  test('a broken audit write never blocks or fails the underlying admin action', async () => {
    await registerOrg(app, {
      orgName: 'Audit Fail Org', domain: 'auditfail.edu', founderName: 'Admin', founderEmail: 'admin@auditfail.edu',
    });

    const original = AuditLog.create;
    AuditLog.create = async () => {
      throw new Error('deliberate test failure - simulated audit log outage');
    };
    try {
      const res = await request(app)
        .post('/api/admin/hostel-configurations')
        .set('X-User-Email', 'admin@auditfail.edu')
        .send({ hostelName: 'Still Works', gender: 'Female', roomTemplates: [{ capacity: 3, count: 1 }] });

      expect(res.status).toBe(201);
      expect(res.body.hostelName).toBe('Still Works');
    } finally {
      AuditLog.create = original;
    }

    const entries = await AuditLog.find({ action: 'HOSTEL_CONFIG_CREATE' }).lean();
    expect(entries.length).toBe(0);
  });
});
