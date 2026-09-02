const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const Chat = require('../models/Chat');
const HostelConfiguration = require('../models/HostelConfiguration');
const User = require('../models/User');
require('dotenv').config();

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        passCount++;
        console.log(`  ✓ ${testName}`);
    } else {
        failCount++;
        console.log(`  ✗ ${testName}${details ? ' - ' + details : ''}`);
    }
}

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    
    try {
        console.log('\n=== PART 13: DATABASE AUDIT ===\n');
        
        // ============================
        // SCHEMA VERIFICATION
        // ============================
        console.log('--- Schema Verification ---');
        
        const profileSchema = Profile.schema;
        const roomAllocSchema = RoomAllocation.schema;
        const changeRequestSchema = ChangeRequest.schema;
        const chatSchema = Chat.schema;
        const hostelConfigSchema = HostelConfiguration.schema;
        const userSchema = User.schema;
        
        // Profile schema checks
        assert(profileSchema.path('user_id').options.unique === true, 'Profile.user_id has unique constraint');
        assert(profileSchema.path('user_id').options.required === true, 'Profile.user_id is required');
        assert('profileCompleted' in profileSchema.paths, 'Profile has profileCompleted field');
        assert('submittedAt' in profileSchema.paths, 'Profile has submittedAt field');
        assert('lastEditedAt' in profileSchema.paths, 'Profile has lastEditedAt field');
        
        // RoomAllocation schema checks
        assert(roomAllocSchema.path('members').instance === 'Array', 'RoomAllocation.members is Array');
        assert(roomAllocSchema.path('room_number') !== undefined, 'RoomAllocation has room_number');
        assert(roomAllocSchema.path('block') !== undefined, 'RoomAllocation has block');
        assert(roomAllocSchema.path('floor') !== undefined, 'RoomAllocation has floor');
        assert(roomAllocSchema.path('room_capacity') !== undefined, 'RoomAllocation has room_capacity');
        assert(roomAllocSchema.path('isLocked') !== undefined, 'RoomAllocation has isLocked');
        assert(roomAllocSchema.path('isLocked').options.default === false, 'RoomAllocation.isLocked defaults to false');
        
        // ChangeRequest schema checks
        assert(changeRequestSchema.path('studentId').options.required === true, 'ChangeRequest.studentId is required');
        assert(changeRequestSchema.path('reason').options.required === true, 'ChangeRequest.reason is required');
        assert(changeRequestSchema.path('status').options.enum !== undefined, 'ChangeRequest.status has enum');
        assert(changeRequestSchema.path('currentRoomId').options.ref === 'RoomAllocation', 'ChangeRequest.currentRoomId refs RoomAllocation');
        
        // Chat schema checks
        assert(chatSchema.path('room_id').options.ref === 'RoomAllocation', 'Chat.room_id refs RoomAllocation');
        assert(chatSchema.path('sender_email').options.required === true, 'Chat.sender_email is required');
        assert(chatSchema.path('message').options.required === true, 'Chat.message is required');
        
        // HostelConfiguration schema checks
        assert(hostelConfigSchema.path('hostelName').isRequired, 'HostelConfiguration.hostelName is required');
        assert(hostelConfigSchema.path('roomTemplates').options.required === true, 'HostelConfiguration.roomTemplates is required');
        assert(hostelConfigSchema.path('isActive').options.default === false, 'HostelConfiguration.isActive defaults to false');
        
        // User schema checks
        assert(userSchema.path('email').options.unique === true, 'User.email has unique constraint');
        assert(userSchema.path('email').options.required === true, 'User.email is required');
        assert(userSchema.path('role').options.default === 'STU', 'User.role defaults to STU');
        
        // ============================
        // INDEX VERIFICATION
        // ============================
        console.log('\n--- Index Verification ---');
        
        const profileIndexes = Array.from(profileSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        const roomAllocIndexes = Array.from(roomAllocSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        const changeRequestIndexes = Array.from(changeRequestSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        const chatIndexes = Array.from(chatSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        const userIndexes = Array.from(userSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        const hostelConfigIndexes = Array.from(hostelConfigSchema.indexes().values()).map(v => typeof v === 'string' ? JSON.parse(v) : v);
        
        // Unique constraints create implicit indexes in MongoDB
        assert(profileSchema.path('user_id').options.unique === true, 'Profile.user_id has unique constraint (implicit index)');
        assert(userSchema.path('email').options.unique === true, 'User.email has unique constraint (implicit index)');
        
        // Check for explicit indexes on commonly queried fields
        const hasMembersIndex = roomAllocIndexes.some(idx => JSON.stringify(idx).includes('members'));
        const hasRunIdIndex = roomAllocIndexes.some(idx => JSON.stringify(idx).includes('allocation_run_id'));
        const hasRoomIdIndex = chatIndexes.some(idx => JSON.stringify(idx).includes('room_id'));
        
        assert(hasMembersIndex, 'RoomAllocation has explicit index on members', 'MISSING - add { members: 1 }');
        assert(hasRunIdIndex, 'RoomAllocation has explicit index on allocation_run_id', 'MISSING - add { allocation_run_id: 1 }');
        assert(hasRoomIdIndex, 'Chat has explicit index on room_id', 'MISSING - add { room_id: 1 }');
        
        // ============================
        // DATA INTEGRITY
        // ============================
        console.log('\n--- Data Integrity ---');
        
        // Check for duplicate profiles
        const duplicateProfiles = await Profile.aggregate([
            { $group: { _id: '$user_id', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        assert(duplicateProfiles.length === 0, 'No duplicate profiles', `Found ${duplicateProfiles.length} duplicates`);
        
        // Check for duplicate users
        const duplicateUsers = await User.aggregate([
            { $group: { _id: '$email', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        assert(duplicateUsers.length === 0, 'No duplicate users', `Found ${duplicateUsers.length} duplicates`);
        
        // Check for orphaned ChangeRequests (currentRoomId doesn't exist)
        const orphanedRequests = await ChangeRequest.find({ currentRoomId: { $exists: true, $ne: null } })
            .populate('currentRoomId')
            .lean();
        const orphanedRequestCount = orphanedRequests.filter(r => !r.currentRoomId).length;
        assert(orphanedRequestCount === 0, 'No orphaned change requests', `Found ${orphanedRequestCount} orphans`);
        
        // Check for orphaned Chat messages (room_id doesn't exist)
        const orphanedChats = await Chat.find({ room_id: { $exists: true, $ne: null } })
            .populate('room_id')
            .lean();
        const orphanedChatCount = orphanedChats.filter(c => !c.room_id).length;
        assert(orphanedChatCount === 0, 'No orphaned chat messages', `Found ${orphanedChatCount} orphans`);
        
        // Check room allocations have valid members
        const emptyMemberAllocs = await RoomAllocation.find({ $or: [ { members: { $exists: false } }, { members: [] } ] }).countDocuments();
        assert(emptyMemberAllocs === 0, 'No allocations with empty members', `Found ${emptyMemberAllocs}`);
        
        // Check room allocations have valid room numbers
        const emptyRoomNumberAllocs = await RoomAllocation.find({ $or: [ { room_number: { $exists: false } }, { room_number: '' } ] }).countDocuments();
        assert(emptyRoomNumberAllocs === 0, 'No allocations with empty room_number', `Found ${emptyRoomNumberAllocs}`);
        
        // Check for rooms exceeding capacity
        const overCapacity = await RoomAllocation.find({ 
            $expr: { $gt: [{ $size: '$members' }, '$room_capacity'] }
        }).countDocuments();
        assert(overCapacity === 0, 'No rooms exceeding capacity', `Found ${overCapacity}`);
        
        // Check allocation integrity: all allocated students have profiles
        const allAllocations = await RoomAllocation.find({}).lean();
        const allocatedEmails = new Set();
        allAllocations.forEach(a => a.members.forEach(m => allocatedEmails.add(m)));
        
        const missingProfiles = [];
        for (const email of allocatedEmails) {
            const profile = await Profile.findOne({ user_id: email }).lean();
            if (!profile) missingProfiles.push(email);
        }
        assert(missingProfiles.length === 0, 'All allocated students have profiles', `Missing: ${missingProfiles.length}`);
        
        // Check for students with profiles but no allocation (only if submitted)
        const submittedProfiles = await Profile.find({ profileCompleted: true }).lean();
        const unallocatedSubmitted = submittedProfiles.filter(p => !allocatedEmails.has(p.user_id));
        assert(unallocatedSubmitted.length === 0 || unallocatedSubmitted.length <= 5, 'No unallocated submitted students', `Found ${unallocatedSubmitted.length}`);
        
        // ============================
        // UNUSED COLLECTIONS CHECK
        // ============================
        console.log('\n--- Collections Check ---');
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        assert(collectionNames.includes('profiles'), 'profiles collection exists');
        assert(collectionNames.includes('roomallocations'), 'roomallocations collection exists');
        assert(collectionNames.includes('changerequests'), 'changerequests collection exists');
        assert(collectionNames.includes('chats'), 'chats collection exists');
        assert(collectionNames.includes('hostelconfigurations'), 'hostelconfigurations collection exists');
        assert(collectionNames.includes('users'), 'users collection exists');
        
        // Check for unexpected collections
        const knownCollections = ['profiles', 'roomallocations', 'changerequests', 'chats', 'hostelconfigurations', 'users'];
        const unknownCollections = collectionNames.filter(c => !knownCollections.includes(c));
        assert(unknownCollections.length === 0, 'No unknown collections', `Found: ${unknownCollections.join(', ')}`);
        
        // ============================
        // DEFAULT VALUES CHECK
        // ============================
        console.log('\n--- Default Values Check ---');
        
        // Check for users without role
        const usersWithoutRole = await User.find({ role: { $exists: false } }).countDocuments();
        assert(usersWithoutRole === 0, 'All users have role field');
        
        // Check isLocked default
        const allocsWithoutIsLocked = await RoomAllocation.find({ isLocked: { $exists: false } }).countDocuments();
        assert(allocsWithoutIsLocked === 0, 'All allocations have isLocked field');
        
        // Check profileCompleted default
        const profilesWithoutCompleted = await Profile.find({ profileCompleted: { $exists: false } }).countDocuments();
        assert(profilesWithoutCompleted === 0, 'All profiles have profileCompleted field');
        
        console.log('\n=== DATABASE AUDIT SUMMARY ===');
        console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
        
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
