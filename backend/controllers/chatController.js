const Chat = require('../models/Chat');
const RoomAllocation = require('../models/RoomAllocation');
const mongoose = require('mongoose');

exports.getRoomChat = async (req, res) => {
    try {
        const { room_id } = req.params;
        const email = req.currentUser.email;

        if (!mongoose.Types.ObjectId.isValid(room_id)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        // Verify the user is actually part of this room
        const room = await RoomAllocation.findById(room_id);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.members.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized: You are not a member of this room' });
        }

        // Fetch messages for this room
        const messages = await Chat.find({ room_id }).sort({ createdAt: 1 });
        
        return res.json(messages);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { room_id } = req.params;
        const { message } = req.body;
        const email = req.currentUser.email;
        const name = req.currentUser.name;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(room_id)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        // Verify the user is part of the room
        const room = await RoomAllocation.findById(room_id);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.members.includes(email)) {
             return res.status(403).json({ error: 'Unauthorized: You are not a member of this room' });
        }

        // Save new message
        const newMsg = new Chat({
            room_id,
            sender_email: email,
            sender_name: name,
            message
        });

        await newMsg.save();

        return res.json(newMsg);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};
