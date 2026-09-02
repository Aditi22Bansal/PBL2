const mongoose = require('mongoose');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const Chat = require('../models/Chat');
require('dotenv').config();

async function fix() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roomsync');
    
    try {
        // 1. Clean up orphaned change requests
        const orphanedRequests = await ChangeRequest.find({ currentRoomId: { $exists: true, $ne: null } })
            .populate('currentRoomId')
            .lean();
        const orphanRequestIds = orphanedRequests.filter(r => !r.currentRoomId).map(r => r._id);
        if (orphanRequestIds.length > 0) {
            await ChangeRequest.deleteMany({ _id: { $in: orphanRequestIds } });
            console.log(`Deleted ${orphanRequestIds.length} orphaned change requests`);
        } else {
            console.log('No orphaned change requests to delete');
        }
        
        // 2. Clean up orphaned chat messages
        const orphanedChats = await Chat.find({ room_id: { $exists: true, $ne: null } })
            .populate('room_id')
            .lean();
        const orphanChatIds = orphanedChats.filter(c => !c.room_id).map(c => c._id);
        if (orphanChatIds.length > 0) {
            await Chat.deleteMany({ _id: { $in: orphanChatIds } });
            console.log(`Deleted ${orphanChatIds.length} orphaned chat messages`);
        } else {
            console.log('No orphaned chat messages to delete');
        }
        
        // 3. Backfill room_capacity for existing allocations
        const allocsWithoutCapacity = await RoomAllocation.find({ 
            $or: [ { room_capacity: { $exists: false } }, { room_capacity: null } ] 
        }).lean();
        
        console.log(`Found ${allocsWithoutCapacity.length} allocations without capacity`);
        
        for (const alloc of allocsWithoutCapacity) {
            await RoomAllocation.findByIdAndUpdate(alloc._id, { 
                room_capacity: alloc.members ? alloc.members.length : 3 
            });
        }
        
        if (allocsWithoutCapacity.length > 0) {
            console.log(`Backfilled capacity for ${allocsWithoutCapacity.length} allocations`);
        }
        
        console.log('Database fixes completed');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
