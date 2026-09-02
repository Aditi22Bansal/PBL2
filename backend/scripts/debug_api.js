const axios = require('axios');
const mongoose = require('mongoose');
const RoomAllocation = require('../models/RoomAllocation');
require('dotenv').config();

async function test() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    
    const alloc = await RoomAllocation.findOne({}).lean();
    const validRoomId = alloc ? alloc._id.toString() : null;
    const studentEmail = alloc ? alloc.members[0] : null;
    
    console.log('Testing toggle-lock missing body...');
    try {
        const res = await axios.post('http://localhost:5000/api/admin/allocations/toggle-lock', {});
        console.log('Status:', res.status, 'Data:', JSON.stringify(res.data));
    } catch (err) {
        console.log('Error status:', err.response?.status, 'Data:', JSON.stringify(err.response?.data));
    }
    
    console.log('\nTesting request-action missing body...');
    try {
        const res = await axios.post('http://localhost:5000/api/admin/requests/action', {});
        console.log('Status:', res.status, 'Data:', JSON.stringify(res.data));
    } catch (err) {
        console.log('Error status:', err.response?.status, 'Data:', JSON.stringify(err.response?.data));
    }
    
    console.log('\nTesting chat POST with valid room...');
    if (validRoomId && studentEmail) {
        try {
            const res = await axios.post('http://localhost:5000/api/chat/' + validRoomId, {
                email: studentEmail,
                name: 'Test',
                message: 'test'
            });
            console.log('Status:', res.status, 'Data:', JSON.stringify(res.data));
        } catch (err) {
            console.log('Error status:', err.response?.status, 'Data:', JSON.stringify(err.response?.data));
        }
    }
    
    await mongoose.disconnect();
}

test();
