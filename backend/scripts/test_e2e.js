const axios = require('axios');
const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const Chat = require('../models/Chat');
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

async function runE2ETests() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    
    try {
        console.log('\n=== PART 15: END-TO-END TESTING (108-Response Dataset) ===\n');
        
        // ============================
        // STEP 1: Admin Google Sheet Sync
        // ============================
        console.log('--- Step 1: Google Sheet Sync ---');
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzPOiW7s1jbwfQlBcKpIuEDCmFqsI3uWZUNr3shrXuRlpsd6N_Jgdb34O3_pzgG_xCxn4cIBKbaNDr/pubhtml';
        
        try {
            const syncRes = await axios.post(`${BASE_URL}/api/admin/sync-csv`, { sheet_url: sheetUrl });
            assert(syncRes.status === 200, 'Google Sheet sync returns 200');
            assert(syncRes.data.message.includes('Successfully synced'), 'Sync returns success message', JSON.stringify(syncRes.data));
            console.log('  Synced profiles count:', syncRes.data.message.match(/\d+/)?.[0] || 'unknown');
        } catch (err) {
            assert(false, 'Google Sheet sync returns 200', err.response?.status + ' ' + JSON.stringify(err.response?.data));
        }
        
        // ============================
        // STEP 2: Trigger Allocation
        // ============================
        console.log('\n--- Step 2: Allocation Engine ---');
        try {
            const allocRes = await axios.post(`${BASE_URL}/api/admin/trigger-allocation`, {});
            assert(allocRes.status === 200, 'Allocation returns 200');
            assert(allocRes.data.message === 'Allocation completed successfully', 'Allocation success message');
            assert(allocRes.data.total_rooms > 0, 'Allocation creates rooms', `Got ${allocRes.data.total_rooms}`);
            assert(allocRes.data.unassigned >= 0, 'Allocation reports unassigned count');
            console.log('  Total rooms:', allocRes.data.total_rooms);
            console.log('  Unassigned:', allocRes.data.unassigned);
        } catch (err) {
            assert(false, 'Allocation returns 200', err.response?.status + ' ' + JSON.stringify(err.response?.data));
        }
        
        // ============================
        // STEP 3: Analytics
        // ============================
        console.log('\n--- Step 3: Analytics ---');
        try {
            const analyticsRes = await axios.get(`${BASE_URL}/api/admin/analytics`);
            assert(analyticsRes.status === 200, 'Analytics returns 200');
            assert('totalStudents' in analyticsRes.data, 'Analytics has totalStudents');
            assert('insights' in analyticsRes.data, 'Analytics has insights');
            assert('conflictAnalysis' in analyticsRes.data, 'Analytics has conflictAnalysis');
            console.log('  Total students:', analyticsRes.data.totalStudents);
        } catch (err) {
            assert(false, 'Analytics returns 200', err.message);
        }
        
        // ============================
        // STEP 4: Conflict Prediction
        // ============================
        console.log('\n--- Step 4: Conflict Prediction ---');
        try {
            const conflictRes = await axios.get(`${BASE_URL}/api/admin/analytics`);
            assert(conflictRes.status === 200, 'Conflict prediction data accessible');
            if (conflictRes.data.conflictAnalysis) {
                assert('insights' in conflictRes.data.conflictAnalysis, 'Conflict analysis has insights');
                console.log('  Conflict insights count:', conflictRes.data.conflictAnalysis.insights?.length || 0);
            }
        } catch (err) {
            assert(false, 'Conflict prediction data accessible', err.message);
        }
        
        // ============================
        // STEP 5: Student Dashboard
        // ============================
        console.log('\n--- Step 5: Student Dashboard ---');
        const alloc = await RoomAllocation.findOne({}).lean();
        const studentEmail = alloc ? alloc.members[0] : null;
        const validRoomId = alloc ? alloc._id.toString() : null;
        
        if (studentEmail) {
            try {
                const dashRes = await axios.get(`${BASE_URL}/api/student/dashboard/${encodeURIComponent(studentEmail)}`);
                assert(dashRes.status === 200, 'Student dashboard returns 200');
                assert(dashRes.data.status === 'ALLOCATED', 'Student status is ALLOCATED');
                assert('profile' in dashRes.data, 'Dashboard has profile');
                assert('allocation' in dashRes.data, 'Dashboard has allocation');
                assert(dashRes.data.allocation.roomId === validRoomId, 'Dashboard has correct roomId');
                assert(dashRes.data.allocation.block !== undefined, 'Dashboard has block');
                assert(dashRes.data.allocation.floor !== undefined, 'Dashboard has floor');
                assert(Array.isArray(dashRes.data.allocation.roommates), 'Dashboard has roommates array');
                assert(dashRes.data.allocation.roommates.length >= 1, 'Dashboard has at least 1 roommate');
                assert('compatibilityScore' in dashRes.data.allocation, 'Dashboard has compatibilityScore');
                assert('thingsToDiscuss' in dashRes.data.allocation, 'Dashboard has thingsToDiscuss');
                console.log('  Roommates:', dashRes.data.allocation.roommates.length);
            } catch (err) {
                assert(false, 'Student dashboard returns 200', err.message);
            }
        }
        
        // ============================
        // STEP 6: Manual Swap
        // ============================
        console.log('\n--- Step 6: Manual Swap ---');
        if (validRoomId && studentEmail) {
            try {
                const allocs = await RoomAllocation.find({ _id: { $ne: validRoomId }, members: { $exists: true, $ne: [] } }).limit(2).lean();
                if (allocs.length >= 1) {
                    const roomAId = validRoomId;
                    const roomBId = allocs[0]._id.toString();
                    const memberA = studentEmail;
                    const memberB = allocs[0].members[0];
                    
                    const swapRes = await axios.post(`${BASE_URL}/api/admin/allocations/manual-swap`, {
                        roomAId,
                        memberA,
                        roomBId,
                        memberB
                    });
                    assert(swapRes.status === 200, 'Manual swap returns 200');
                    assert(swapRes.data.message === 'Swap completed successfully', 'Manual swap success message');
                    
                    // Verify swap
                    const updatedA = await RoomAllocation.findById(roomAId).lean();
                    const updatedB = await RoomAllocation.findById(roomBId).lean();
                    assert(updatedA.members.includes(memberB), 'Member swapped to room A');
                    assert(updatedB.members.includes(memberA), 'Member swapped to room B');
                } else {
                    console.log('  Skipped: Not enough rooms for swap test');
                }
            } catch (err) {
                assert(false, 'Manual swap returns 200', err.response?.status + ' ' + JSON.stringify(err.response?.data));
            }
        }
        
        // ============================
        // STEP 7: Lock Room
        // ============================
        console.log('\n--- Step 7: Lock Room ---');
        if (validRoomId) {
            try {
                const lockRes = await axios.post(`${BASE_URL}/api/admin/allocations/toggle-lock`, {
                    roomId: validRoomId,
                    isLocked: true
                });
                assert(lockRes.status === 200, 'Lock room returns 200');
                assert(lockRes.data.message === 'Room locked', 'Lock success message');
                
                const lockedRoom = await RoomAllocation.findById(validRoomId).lean();
                assert(lockedRoom.isLocked === true, 'Room is locked in database');
            } catch (err) {
                assert(false, 'Lock room returns 200', err.message);
            }
        }
        
        // ============================
        // STEP 8: Force Allocate
        // ============================
        console.log('\n--- Step 8: Force Allocate ---');
        try {
            const forceRes = await axios.post(`${BASE_URL}/api/admin/force-allocate`, {});
            assert(forceRes.status === 200, 'Force allocate returns 200');
            assert(forceRes.data.message.includes('Force-allocated'), 'Force allocate success message');
            assert(typeof forceRes.data.total_new_rooms === 'number', 'Force allocate returns room count');
            console.log('  New rooms:', forceRes.data.total_new_rooms);
        } catch (err) {
            assert(false, 'Force allocate returns 200', err.message);
        }
        
        // ============================
        // STEP 9: CSV Export
        // ============================
        console.log('\n--- Step 9: CSV Export ---');
        try {
            const csvRes = await axios.get(`${BASE_URL}/api/admin/allocations/report`);
            assert(csvRes.status === 200, 'CSV export returns 200');
            assert(csvRes.headers['content-type'].includes('text/csv'), 'CSV content type correct');
            assert(csvRes.data.includes('Room Number,Block,Floor'), 'CSV has expected headers');
            console.log('  CSV length:', csvRes.data.length, 'chars');
        } catch (err) {
            assert(false, 'CSV export returns 200', err.message);
        }
        
        // ============================
        // STEP 10: Request Approval
        // ============================
        console.log('\n--- Step 10: Request Approval ---');
        if (studentEmail && validRoomId) {
            try {
                // Submit a change request
                const reqRes = await axios.post(`${BASE_URL}/api/student/change-request`, {
                    email: studentEmail,
                    name: 'Test Student',
                    roomId: validRoomId,
                    reason: 'E2E test request'
                });
                assert(reqRes.status === 201, 'Change request submitted returns 201');
                const requestId = reqRes.data._id || (await ChangeRequest.findOne({ studentId: studentEmail }).lean())._id;
                
                // Approve the request
                const actionRes = await axios.post(`${BASE_URL}/api/admin/requests/action`, {
                    requestId: requestId,
                    status: 'Approved'
                });
                assert(actionRes.status === 200, 'Request approval returns 200');
                assert(actionRes.data.message === 'Request Approved', 'Request approval message');
                
                // Verify in database
                const updatedReq = await ChangeRequest.findById(requestId).lean();
                assert(updatedReq.status === 'Approved', 'Request status updated to Approved');
            } catch (err) {
                assert(false, 'Request approval flow works', err.response?.status + ' ' + JSON.stringify(err.response?.data));
            }
        }
        
        // ============================
        // STEP 11: Chat
        // ============================
        console.log('\n--- Step 11: Chat ---');
        const freshAlloc = await RoomAllocation.findOne({}).lean();
        const freshRoomId = freshAlloc ? freshAlloc._id.toString() : validRoomId;
        const freshStudentEmail = freshAlloc ? freshAlloc.members[0] : studentEmail;
        
        if (freshRoomId && freshStudentEmail) {
            try {
                // Get chat messages
                const chatGetRes = await axios.get(`${BASE_URL}/api/chat/${freshRoomId}?email=${encodeURIComponent(freshStudentEmail)}`);
                assert(chatGetRes.status === 200, 'Chat GET returns 200');
                assert(Array.isArray(chatGetRes.data), 'Chat returns array');
                
                // Send chat message
                const chatPostRes = await axios.post(`${BASE_URL}/api/chat/${freshRoomId}`, {
                    email: freshStudentEmail,
                    name: 'Test Student',
                    message: 'E2E test message'
                });
                assert(chatPostRes.status === 200, 'Chat POST returns 200');
                assert(chatPostRes.data.message === 'E2E test message', 'Chat message saved');
            } catch (err) {
                assert(false, 'Chat works', err.response?.status + ' ' + JSON.stringify(err.response?.data));
            }
        }
        
        // ============================
        // STEP 12: Unlock Room (cleanup)
        // ============================
        console.log('\n--- Step 12: Cleanup (Unlock Room) ---');
        if (validRoomId) {
            try {
                const unlockRes = await axios.post(`${BASE_URL}/api/admin/allocations/toggle-lock`, {
                    roomId: validRoomId,
                    isLocked: false
                });
                assert(unlockRes.status === 200, 'Unlock room returns 200');
            } catch (err) {
                assert(false, 'Unlock room returns 200', err.message);
            }
        }
        
        // ============================
        // FINAL SUMMARY
        // ============================
        console.log('\n=== E2E TEST SUMMARY ===');
        console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
        
        if (failCount > 0) {
            console.log('\nFailed tests:');
            testResults.filter(t => t.status === 'FAIL').forEach(t => {
                console.log(`  - ${t.test}: ${t.details}`);
            });
        }
        
    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runE2ETests();
