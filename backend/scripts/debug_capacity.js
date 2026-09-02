const mongoose = require('mongoose');
const RoomAllocation = require('../models/RoomAllocation');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    const allocs = await RoomAllocation.find({}).limit(10).lean();
    allocs.forEach(a => {
        console.log(a.room_number, 'capacity:', a.room_capacity, 'members:', a.members.length);
    });
    
    const noCapacity = await RoomAllocation.find({ room_capacity: { $exists: false } }).countDocuments();
    const nullCapacity = await RoomAllocation.find({ room_capacity: null }).countDocuments();
    const definedCapacity = await RoomAllocation.find({ room_capacity: { $exists: true, $ne: null } }).countDocuments();
    console.log('No capacity field:', noCapacity);
    console.log('Null capacity:', nullCapacity);
    console.log('Defined capacity:', definedCapacity);
    
    const total = await RoomAllocation.countDocuments();
    console.log('Total allocations:', total);
    
    await mongoose.disconnect();
}

check();
