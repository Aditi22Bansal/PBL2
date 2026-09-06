// Shared in-memory MongoDB lifecycle helpers for the Jest suite (test_*.js in this
// same directory - Python's pytest suite also lives here, test_*.py, and the two
// coexist without conflict: pytest only ever discovers .py files, Jest is
// explicitly configured (see package.json's "jest" key) to only discover test_*.js).
//
// Each test file gets its OWN in-memory mongod instance (started in that file's own
// beforeAll, stopped in its own afterAll) - full isolation between files, no shared
// state to leak between them. Real MongoDB binary under the hood (downloaded once,
// cached), not a mock - real unique indexes and query semantics apply exactly as
// they would against the actual dev database.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, closeDatabase, clearDatabase };
