const axios = require('../node_modules/axios').default;
const mongoose = require('../node_modules/mongoose');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
require('dotenv').config();

async function testForceAllocate() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roomsync');
    
    try {
        // Add 3 unassigned profiles temporarily
        const testProfiles = [
            { user_id: 'test_unassigned_1@test.com', name: 'Test Student 1', gender: 'Male', branch: 'CSE', year_of_study: '2nd Year', profileCompleted: true, submittedAt: new Date() },
            { user_id: 'test_unassigned_2@test.com', name: 'Test Student 2', gender: 'Male', branch: 'CSE', year_of_study: '2nd Year', profileCompleted: true, submittedAt: new Date() },
            { user_id: 'test_unassigned_3@test.com', name: 'Test Student 3', gender: 'Male', branch: 'CSE', year_of_study: '2nd Year', profileCompleted: true, submittedAt: new Date() }
        ];
        
        await Profile.insertMany(testProfiles);
        console.log('Added 3 unassigned test profiles');
        
        // Run force allocate via API
        const forceRes = await axios.post('http://localhost:5000/api/admin/force-allocate');
        console.log('Force allocate result:', JSON.stringify(forceRes.data));
        
        // Verify force-allocated rooms exist
        const allRes = await axios.get('http://localhost:5000/api/admin/allocations');
        const allocs = allRes.data.allocations || [];
        const forceRooms = allocs.filter(a => a.allocation_run_id === 'force_allocated');
        console.log('Force allocated rooms created:', forceRooms.length);
        forceRooms.forEach(r => {
            console.log('  Room:', r.room_number, '| Block:', r.block, '| Floor:', r.floor, '| Members:', r.members.length, '| isLocked:', r.isLocked);
        });
        
        if (forceRooms.length > 0) {
            console.log('PASS: Force allocate created new rooms');
        } else {
            console.log('FAIL: No force-allocated rooms found');
        }
        
        // Clean up test profiles and force rooms
        const testIds = ['test_unassigned_1@test.com', 'test_unassigned_2@test.com', 'test_unassigned_3@test.com'];
        await Profile.deleteMany({ user_id: { $in: testIds } });
        await RoomAllocation.deleteMany({ allocation_run_id: 'force_allocated' });
        console.log('Cleanup: Test profiles and force rooms deleted');
        
    } catch (err) {
        console.error('ERROR:', err.message, err.response ? JSON.stringify(err.response.data) : '');
    } finally {
        await mongoose.disconnect();
    }
}

testForceAllocate();
