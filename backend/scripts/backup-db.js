// One-off backup script: dumps every document in the given database's 6 known
// collections to local JSON files, so there's an actual recoverable backup on
// disk before running a migration against it.
//
// Usage: node scripts/backup-db.js [dbName]
//   dbName defaults to "hostel_allocator" (the real live database).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const dbName = process.argv[2] || 'hostel_allocator';
const baseUri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostel_allocator').replace(/\/[^/]+$/, '');
const uri = `${baseUri}/${dbName}`;

const COLLECTIONS = ['users', 'profiles', 'roomallocations', 'hostelconfigurations', 'changerequests', 'chats'];

async function run() {
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(__dirname, 'backups', `pre-migration-${timestamp}`);
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`Writing backup to: ${outDir}`);

    const summary = {};
    for (const name of COLLECTIONS) {
        const docs = await db.collection(name).find({}).toArray();
        const filePath = path.join(outDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        summary[name] = docs.length;
        console.log(`  ${name}: ${docs.length} documents -> ${filePath}`);
    }

    fs.writeFileSync(
        path.join(outDir, '_manifest.json'),
        JSON.stringify({ dbName, uri, timestamp, counts: summary }, null, 2)
    );

    console.log('\nSummary:', summary);
    console.log('Backup complete.');

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
});
