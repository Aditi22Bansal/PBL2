const axios = require('axios');
const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const HostelConfiguration = require('../models/HostelConfiguration');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';
let passCount = 0;
let failCount = 0;
let testResults = [];

function assert(condition, testName, details = '') {
    if (condition) {
        passCount++;
        testResults.push({ status: 'PASS', test: testName, details });
        console.log(`  ✓ ${testName}`);
    } else {
        failCount++;
        testResults.push({ status: 'FAIL', test: testName, details });
        console.log(`  ✗ ${testName}${details ? ' - ' + details : ''}`);
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    
    try {
        // Get a valid allocated student
        const alloc = await RoomAllocation.findOne({}).lean();
        const studentEmail = alloc ? alloc.members[0] : null;
        const validRoomId = alloc ? alloc._id.toString() : null;
        
        console.log('\n=== PART 12: API ENDPOINT AUDIT ===\n');
        
        // ============================
        // STUDENT ENDPOINTS
        // ============================
        console.log('--- Student Endpoints ---');
        
        // GET /api/student/dashboard/:email - missing email
        try {
            const res = await axios.get(`${BASE_URL}/api/student/dashboard/`);
            assert(res.status === 404 || res.status === 400, 'Dashboard missing email returns error');
        } catch (err) {
            assert(err.response?.status === 404 || err.response?.status === 400, 'Dashboard missing email returns error');
        }
        
        // GET /api/student/dashboard/:email - valid
        if (studentEmail) {
            try {
                const res = await axios.get(`${BASE_URL}/api/student/dashboard/${encodeURIComponent(studentEmail)}`);
                assert(res.status === 200, 'Dashboard valid email returns 200');
                assert(res.data.status === 'ALLOCATED' || res.data.status === 'PENDING_ALLOCATION' || res.data.status === 'NOT_SUBMITTED', 'Dashboard returns valid status');
                assert('profile' in res.data, 'Dashboard includes profile');
                assert('allocation' in res.data, 'Dashboard includes allocation when allocated');
                if (res.data.allocation) {
                    assert('roomId' in res.data.allocation, 'Allocation has roomId');
                    assert('block' in res.data.allocation, 'Allocation has block');
                    assert('floor' in res.data.allocation, 'Allocation has floor');
                    assert('roommates' in res.data.allocation, 'Allocation has roommates');
                }
            } catch (err) {
                assert(false, 'Dashboard valid email returns 200', err.message);
            }
        }
        
        // GET /api/student/profile - missing header
        try {
            const res = await axios.get(`${BASE_URL}/api/student/profile`);
            assert(res.status === 401, 'Profile missing X-User-Email returns 401');
        } catch (err) {
            assert(err.response?.status === 401, 'Profile missing X-User-Email returns 401');
        }
        
        // GET /api/student/profile - valid header
        if (studentEmail) {
            try {
                const res = await axios.get(`${BASE_URL}/api/student/profile`, {
                    headers: { 'X-User-Email': studentEmail }
                });
                assert(res.status === 200, 'Profile valid header returns 200');
                assert(res.data.profileCompleted !== undefined || res.data.user_id !== undefined, 'Profile returns data');
            } catch (err) {
                assert(false, 'Profile valid header returns 200', err.message);
            }
        }
        
        // PUT /api/student/profile - missing header
        try {
            const res = await axios.put(`${BASE_URL}/api/student/profile`, { name: 'Test' });
            assert(res.status === 401, 'Save profile missing header returns 401');
        } catch (err) {
            assert(err.response?.status === 401, 'Save profile missing header returns 401');
        }
        
        // PUT /api/student/profile - valid
        if (studentEmail) {
            try {
                const res = await axios.put(`${BASE_URL}/api/student/profile`, { name: 'Test Update' }, {
                    headers: { 'X-User-Email': studentEmail }
                });
                assert(res.status === 200, 'Save profile valid returns 200');
                assert(res.data.profileCompleted === false, 'Save profile sets profileCompleted false');
                assert(res.data.lastEditedAt !== undefined, 'Save profile sets lastEditedAt');
            } catch (err) {
                assert(false, 'Save profile valid returns 200', err.message);
            }
        }
        
        // POST /api/student/profile/submit - missing header
        try {
            const res = await axios.post(`${BASE_URL}/api/student/profile/submit`, {});
            assert(res.status === 401, 'Submit profile missing header returns 401');
        } catch (err) {
            assert(err.response?.status === 401, 'Submit profile missing header returns 401');
        }
        
        // POST /api/student/profile/submit - valid
        if (studentEmail) {
            try {
                const res = await axios.post(`${BASE_URL}/api/student/profile/submit`, {}, {
                    headers: { 'X-User-Email': studentEmail }
                });
                assert(res.status === 200, 'Submit profile valid returns 200');
                assert(res.data.profileCompleted === true, 'Submit profile sets profileCompleted true');
                assert(res.data.submittedAt !== undefined, 'Submit profile sets submittedAt');
            } catch (err) {
                assert(false, 'Submit profile valid returns 200', err.message);
            }
        }
        
        // POST /api/student/change-request - missing body
        try {
            const res = await axios.post(`${BASE_URL}/api/student/change-request`, {});
            assert(res.status === 400 || res.status === 500, 'Change request empty body returns error');
        } catch (err) {
            assert(err.response?.status === 400 || err.response?.status === 500, 'Change request empty body returns error');
        }
        
        // POST /api/student/change-request - valid
        if (studentEmail && validRoomId) {
            try {
                const res = await axios.post(`${BASE_URL}/api/student/change-request`, {
                    email: studentEmail,
                    name: 'Test Student',
                    roomId: validRoomId,
                    reason: 'Need to change room for testing'
                });
                assert(res.status === 201, 'Change request valid returns 201');
                assert(res.data.message === 'Request submitted to admin', 'Change request returns success message');
            } catch (err) {
                assert(false, 'Change request valid returns 201', err.message);
            }
        }
        
        // ============================
        // ADMIN ENDPOINTS
        // ============================
        console.log('\n--- Admin Endpoints ---');
        
        // GET /api/admin/allocations
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/allocations`);
            assert(res.status === 200, 'Admin allocations returns 200');
            assert(Array.isArray(res.data.allocations), 'Admin allocations returns array');
            assert(Array.isArray(res.data.unassigned), 'Admin allocations returns unassigned array');
        } catch (err) {
            assert(false, 'Admin allocations returns 200', err.message);
        }
        
        // GET /api/admin/analytics
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/analytics`);
            assert(res.status === 200, 'Admin analytics returns 200');
            assert('totalStudents' in res.data || 'insights' in res.data, 'Admin analytics returns data');
        } catch (err) {
            assert(false, 'Admin analytics returns 200', err.message);
        }
        
        // GET /api/admin/submission-stats
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/submission-stats`);
            assert(res.status === 200, 'Admin submission-stats returns 200');
            assert('totalStudents' in res.data, 'Admin submission-stats returns totalStudents');
            assert('profilesCompleted' in res.data, 'Admin submission-stats returns profilesCompleted');
        } catch (err) {
            assert(false, 'Admin submission-stats returns 200', err.message);
        }
        
        // GET /api/admin/hostel-configurations
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/hostel-configurations`);
            assert(res.status === 200, 'Admin hostel-configurations returns 200');
            assert(Array.isArray(res.data), 'Admin hostel-configurations returns array');
        } catch (err) {
            assert(false, 'Admin hostel-configurations returns 200', err.message);
        }
        
        // GET /api/admin/hostel-configurations/:id - invalid id
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/hostel-configurations/invalid-id`);
            assert(res.status === 400 || res.status === 404 || res.status === 500, 'Hostel config invalid id returns error');
        } catch (err) {
            assert(err.response?.status === 400 || err.response?.status === 404 || err.response?.status === 500, 'Hostel config invalid id returns error');
        }
        
        // GET /api/admin/requests
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/requests`);
            assert(res.status === 200, 'Admin requests returns 200');
            assert(Array.isArray(res.data), 'Admin requests returns array');
        } catch (err) {
            assert(false, 'Admin requests returns 200', err.message);
        }
        
        // GET /api/admin/allocations/report
        try {
            const res = await axios.get(`${BASE_URL}/api/admin/allocations/report`);
            assert(res.status === 200, 'Admin allocations/report returns 200');
            assert(res.headers['content-type'].includes('text/csv'), 'Report returns CSV content type');
        } catch (err) {
            assert(false, 'Admin allocations/report returns 200', err.message);
        }
        
        // POST /api/admin/sync-csv - missing body
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/sync-csv`, {});
            assert(res.status === 400, 'Sync CSV missing sheet_url returns 400');
        } catch (err) {
            assert(err.response?.status === 400, 'Sync CSV missing sheet_url returns 400');
        }
        
        // POST /api/admin/trigger-allocation - should work with 108 profiles
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/trigger-allocation`, {});
            assert(res.status === 200, 'Trigger allocation returns 200');
            assert(res.data.message !== undefined, 'Trigger allocation returns message');
        } catch (err) {
            assert(false, 'Trigger allocation returns 200', err.message);
        }
        
        // Refresh room ID after trigger allocation (it deletes unlocked allocations)
        const freshAlloc = await RoomAllocation.findOne({}).lean();
        const freshStudentEmail = freshAlloc ? freshAlloc.members[0] : studentEmail;
        const freshRoomId = freshAlloc ? freshAlloc._id.toString() : validRoomId;
        
        // POST /api/admin/allocations/manual-swap - missing body
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/allocations/manual-swap`, {});
            assert(res.status === 400 || res.status === 500, 'Manual swap missing body returns error');
        } catch (err) {
            assert(err.response?.status === 400 || err.response?.status === 500, 'Manual swap missing body returns error');
        }
        
        // POST /api/admin/allocations/toggle-lock - missing body (should now return 400)
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/allocations/toggle-lock`, {});
            assert(false, 'Toggle lock missing body returns 400', 'Returned ' + res.status);
        } catch (err) {
            assert(err.response?.status === 400, 'Toggle lock missing body returns 400');
        }
        
        // POST /api/admin/allocations/toggle-lock - invalid roomId
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/allocations/toggle-lock`, { roomId: 'invalid-id', isLocked: true });
            assert(false, 'Toggle lock invalid id returns 500', 'Returned ' + res.status);
        } catch (err) {
            assert(err.response?.status === 400 || err.response?.status === 500, 'Toggle lock invalid id returns 400/500', 'Got ' + (err.response?.status || 'no status'));
        }
        
        // POST /api/admin/force-allocate - no unassigned
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/force-allocate`, {});
            assert(res.status === 200, 'Force allocate returns 200');
            assert(res.data.message !== undefined, 'Force allocate returns message');
        } catch (err) {
            assert(false, 'Force allocate returns 200', err.message);
        }
        
        // POST /api/admin/requests/action - missing body (should now return 400)
        try {
            const res = await axios.post(`${BASE_URL}/api/admin/requests/action`, {});
            assert(false, 'Request action missing body returns 400', 'Returned ' + res.status);
        } catch (err) {
            assert(err.response?.status === 400, 'Request action missing body returns 400');
        }
        
        // ============================
        // CHAT ENDPOINTS
        // ============================
        console.log('\n--- Chat Endpoints ---');
        
        // GET /api/chat/:room_id - missing email
        if (freshRoomId) {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/${freshRoomId}`);
                assert(res.status === 400, 'Chat missing email returns 400');
                assert(res.data.error === 'Email is required to access chat', 'Chat missing email returns proper error');
            } catch (err) {
                assert(err.response?.status === 400, 'Chat missing email returns 400');
                assert(err.response?.data?.error === 'Email is required to access chat', 'Chat missing email returns proper error');
            }
        }
        
        // GET /api/chat/:room_id - invalid room id
        try {
            const res = await axios.get(`${BASE_URL}/api/chat/invalid-id?email=test@test.com`);
            assert(res.status === 400 || res.status === 404, 'Chat invalid room id returns error');
        } catch (err) {
            assert(err.response?.status === 400 || err.response?.status === 404, 'Chat invalid room id returns error');
        }
        
        // GET /api/chat/:room_id - valid but unauthorized
        if (freshRoomId) {
            try {
                const res = await axios.get(`${BASE_URL}/api/chat/${freshRoomId}?email=unauthorized@test.com`);
                assert(res.status === 403 || res.status === 404, 'Chat unauthorized email returns 403/404');
            } catch (err) {
                assert(err.response?.status === 403 || err.response?.status === 404, 'Chat unauthorized email returns 403/404');
            }
        }
        
        // POST /api/chat/:room_id - missing body
        if (validRoomId) {
            try {
                const res = await axios.post(`${BASE_URL}/api/chat/${validRoomId}`, {});
                assert(res.status === 400, 'Chat POST missing body returns 400');
            } catch (err) {
                assert(err.response?.status === 400, 'Chat POST missing body returns 400');
            }
        }
        
        // POST /api/chat/:room_id - valid
        if (freshRoomId && freshStudentEmail) {
            try {
                const res = await axios.post(`${BASE_URL}/api/chat/${freshRoomId}`, {
                    email: freshStudentEmail,
                    name: 'Test Student',
                    message: 'Hello from audit test'
                });
                assert(res.status === 200 || res.status === 201, 'Chat POST valid returns 200/201', 'Got ' + res.status);
                assert(res.data._id !== undefined || res.data.message !== undefined, 'Chat POST returns saved message');
            } catch (err) {
                assert(false, 'Chat POST valid returns 200/201', err.response?.status + ' ' + JSON.stringify(err.response?.data));
            }
        }
        
        // ============================
        // AUTH ENDPOINTS
        // ============================
        console.log('\n--- Auth Endpoints ---');
        
        // GET /api/health
        try {
            const res = await axios.get(`${BASE_URL}/api/health`);
            assert(res.status === 200, 'Health check returns 200');
            assert(res.data.status === 'ok', 'Health check returns ok status');
        } catch (err) {
            assert(false, 'Health check returns 200', err.message);
        }
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
        
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
