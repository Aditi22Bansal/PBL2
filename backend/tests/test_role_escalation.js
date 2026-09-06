// Permanent regression test for the real vulnerability documented in SECURITY.md #2:
// `sync-user` used to write `role` straight from the request body on EVERY login
// (upsert), letting any user self-promote to ADMIN. Fixed via $setOnInsert (role set
// only at creation, always STUDENT) + $set (never includes role).
const request = require('supertest');
const User = require('../models/User');
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

describe('role escalation via sync-user', () => {
  test('forging role: "ADMIN" on an EXISTING student account does not change it - verified by a direct DB read', async () => {
    await registerOrg(app, {
      orgName: 'Escalation Org',
      domain: 'escalation.edu',
      founderName: 'Founder',
      founderEmail: 'founder@escalation.edu',
    });

    // Real first login - creates the account as STUDENT.
    const first = await syncUser(app, { email: 'victim@escalation.edu', name: 'Victim' });
    expect(first.status).toBe(200);
    expect(first.body.role).toBe('STUDENT');

    // The exploit attempt: a repeat login forging role: "ADMIN".
    const exploit = await syncUser(app, { email: 'victim@escalation.edu', name: 'Victim', role: 'ADMIN' });
    expect(exploit.status).toBe(200);
    expect(exploit.body.role).toBe('STUDENT');

    // Not just trusting the API's own response - read the actual stored document.
    const stored = await User.findOne({ email: 'victim@escalation.edu' });
    expect(stored.role).toBe('STUDENT');
  });

  test('first-ever account creation with role: "ADMIN" injected is still forced to STUDENT', async () => {
    await registerOrg(app, {
      orgName: 'Escalation Org 2',
      domain: 'escalation2.edu',
      founderName: 'Founder',
      founderEmail: 'founder@escalation2.edu',
    });

    // No prior account exists for this email - this call both creates it AND
    // attempts the injection in the same request.
    const res = await syncUser(app, { email: 'newuser@escalation2.edu', name: 'New User', role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('STUDENT');

    const stored = await User.findOne({ email: 'newuser@escalation2.edu' });
    expect(stored.role).toBe('STUDENT');
  });
});
