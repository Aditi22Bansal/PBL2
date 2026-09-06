// Test-only fixture factory, mirroring the real registration/sync-user shape - goes
// through the actual HTTP endpoints (not direct model writes), so fixtures exercise
// the same code path production traffic does.
const request = require('supertest');

async function registerOrg(app, { orgName, domain, founderName, founderEmail }) {
  return request(app).post('/api/auth/register-organization').send({
    orgName, domain, founderName, founderEmail,
  });
}

// `role` is deliberately accepted here (and forwarded straight into the request body)
// so exploit tests can attempt exactly what the real vulnerability was: injecting a
// role via this call. Legitimate fixtures simply omit it.
async function syncUser(app, { email, name, role }) {
  const body = { email, name };
  if (role !== undefined) body.role = role;
  return request(app).post('/api/auth/sync-user').send(body);
}

module.exports = { registerOrg, syncUser };
