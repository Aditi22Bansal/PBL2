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

        // Verify the user is actually part of this room (and that the room
        // belongs to their org - a room ID from another org should read as
        // not-found, not a membership failure).
        const room = await RoomAllocation.findOne({ _id: room_id, organizationId: req.currentUser.organizationId });
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.members.includes(email)) {
            return res.status(403).json({ error: 'Unauthorized: You are not a member of this room' });
        }

        // Fetch messages for this room
        const messages = await Chat.find({ room_id, organizationId: req.currentUser.organizationId }).sort({ createdAt: 1 });
        
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

        // Verify the user is part of the room (and that the room belongs to
        // their org)
        const room = await RoomAllocation.findOne({ _id: room_id, organizationId: req.currentUser.organizationId });
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.members.includes(email)) {
             return res.status(403).json({ error: 'Unauthorized: You are not a member of this room' });
        }

        // Save new message
        const newMsg = new Chat({
            organizationId: req.currentUser.organizationId,
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
