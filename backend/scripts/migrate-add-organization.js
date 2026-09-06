// One-time migration: insert the SIT Pune Organization document (using the fixed
// _id shared with every schema's `organizationId` default - see
// backend/config/defaultOrg.js) and backfill organizationId onto every existing
// document across the 6 collections that doesn't already have it.
//
// Purely additive: never changes any existing field value, never removes any
// document. Safe to run more than once (idempotent - $exists:false filters mean
// a second run finds nothing left to update).
//
// Usage: node scripts/migrate-add-organization.js [dbName]
//   dbName defaults to "hostel_allocator" (the real live database).

require('dotenv').config();
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const User = require('../models/User');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const HostelConfiguration = require('../models/HostelConfiguration');
const ChangeRequest = require('../models/ChangeRequest');
const Chat = require('../models/Chat');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const dbName = process.argv[2] || 'hostel_allocator';
const baseUri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostel_allocator').replace(/\/[^/]+$/, '');
const uri = `${baseUri}/${dbName}`;

const COLLECTIONS = [
    { name: 'users', Model: User },
    { name: 'profiles', Model: Profile },
    { name: 'roomallocations', Model: RoomAllocation },
    { name: 'hostelconfigurations', Model: HostelConfiguration },
    { name: 'changerequests', Model: ChangeRequest },
    { name: 'chats', Model: Chat }
];

async function run() {
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    console.log('Connected.\n');

    // Step 1: insert the Organization document, using the fixed shared _id so it
    // matches every schema's `organizationId` default exactly.
    let org = await Organization.findById(SIT_PUNE_ORG_ID);
    if (!org) {
        org = await Organization.create({
            _id: SIT_PUNE_ORG_ID,
            name: 'Symbiosis Institute of Technology, Pune',
            slug: 'sit-pune',
            allowedEmailDomains: ['sitpune.edu.in']
        });
        console.log(`Created Organization document: ${org._id.toString()}`);
    } else {
        console.log(`Organization document already exists: ${org._id.toString()}`);
    }

    // Step 2: backfill organizationId on every existing document, per collection,
    // only where it doesn't already exist.
    console.log('\nBackfilling organizationId:');
    const summary = {};
    for (const { name, Model } of COLLECTIONS) {
        const totalBefore = await Model.countDocuments({});
        const missingBefore = await Model.countDocuments({ organizationId: { $exists: false } });

        const result = await Model.updateMany(
            { organizationId: { $exists: false } },
            { $set: { organizationId: SIT_PUNE_ORG_ID } }
        );

        const totalAfter = await Model.countDocuments({});
        const missingAfter = await Model.countDocuments({ organizationId: { $exists: false } });

        summary[name] = { totalBefore, totalAfter, missingBefore, modified: result.modifiedCount, missingAfter };
        console.log(
            `  ${name}: total ${totalBefore} -> ${totalAfter} | missing organizationId before: ${missingBefore}, ` +
            `modified: ${result.modifiedCount}, missing after: ${missingAfter}`
        );
    }

    console.log('\nSummary:', JSON.stringify(summary, null, 2));

    const anyStillMissing = Object.values(summary).some((s) => s.missingAfter > 0);
    const anyCountChanged = Object.values(summary).some((s) => s.totalBefore !== s.totalAfter);
    if (anyStillMissing || anyCountChanged) {
        console.error('\nMIGRATION INCOMPLETE OR UNSAFE - see summary above.');
        process.exitCode = 1;
    } else {
        console.log('\nMigration complete: every document across all 6 collections now has organizationId, document counts unchanged.');
    }

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
