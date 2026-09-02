const axios = require('../node_modules/axios').default;
const mongoose = require('../node_modules/mongoose');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
require('dotenv').config();

async function verifyStudentAPI() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roomsync');
    try {
        // Find an allocated student to test student dashboard
        const alloc = await RoomAllocation.findOne({}).lean();
        const studentEmail = alloc ? alloc.members[0] : null;
        console.log('Testing with student:', studentEmail);
        
        if (studentEmail) {
            // Part 11: Student Dashboard API
            console.log('\n=== PART 11: Student Dashboard API ===');
            const dashRes = await axios.get('http://localhost:5000/api/student/dashboard/' + studentEmail);
            const dashboard = dashRes.data;
            console.log('Status:', dashRes.status);
            console.log('Dashboard status:', dashboard.status);
            console.log('Profile keys:', Object.keys(dashboard.profile || {}));
            console.log('Allocation keys:', Object.keys(dashboard.allocation || {}));
            console.log('Allocation has block:', 'block' in (dashboard.allocation || {}) ? 'YES' : 'NO - BUG!');
            console.log('Allocation has floor:', 'floor' in (dashboard.allocation || {}) ? 'YES' : 'NO - BUG!');
            console.log('Allocation has roomId:', 'roomId' in (dashboard.allocation || {}) ? 'YES' : 'NO - BUG!');
            console.log('Roommates count:', dashboard.allocation && dashboard.allocation.roommates ? dashboard.allocation.roommates.length : 'N/A');
            console.log('\nFull student allocation object:', JSON.stringify(dashboard.allocation));
        }
        
        // Part 12: Check all routes
        console.log('\n=== PART 12: Full API Route Audit ===');
        const routes = [
            { method: 'GET', url: 'http://localhost:5000/api/admin/allocations' },
            { method: 'GET', url: 'http://localhost:5000/api/admin/analytics' },
            { method: 'GET', url: 'http://localhost:5000/api/admin/submission-stats' },
            { method: 'GET', url: 'http://localhost:5000/api/admin/hostel-configurations' },
            { method: 'GET', url: 'http://localhost:5000/api/admin/requests' },
            { method: 'GET', url: 'http://localhost:5000/api/admin/allocations/report' },
        ];
        
        for (const route of routes) {
            try {
                const res = await axios.get(route.url);
                console.log('GET', route.url.replace('http://localhost:5000', ''), '- STATUS:', res.status, '- PASS');
            } catch(err2) {
                console.log('GET', route.url.replace('http://localhost:5000', ''), '- STATUS:', err2.response ? err2.response.status : 'ERR', '- FAIL:', err2.message);
            }
        }
        
        // Chat rooms route
        try {
            const chatRes = await axios.get('http://localhost:5000/api/chat/rooms');
            console.log('GET /api/chat/rooms - STATUS:', chatRes.status, '- PASS');
        } catch(chatErr) {
            console.log('GET /api/chat/rooms - STATUS:', chatErr.response ? chatErr.response.status : 'ERR', '- Note:', chatErr.response ? JSON.stringify(chatErr.response.data) : chatErr.message);
        }
        
    } catch (err) {
        console.error('ERROR:', err.message, err.response ? JSON.stringify(err.response.data) : '');
    } finally {
        await mongoose.disconnect();
    }
}

verifyStudentAPI();
