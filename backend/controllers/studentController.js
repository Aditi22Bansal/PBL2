const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const User = require('../models/User');

exports.getDashboardData = async (req, res) => {
    try {
        const { email } = req.params;
        
        // 1. Check if student has submitted form
        const profile = await Profile.findOne({ user_id: email });
        if (!profile) {
            return res.json({ status: 'NOT_SUBMITTED', message: 'You have not submitted the preference form.' });
        }
        
        // 2. Check if student is allocated
        const allocation = await RoomAllocation.findOne({ members: email });
        if (allocation) {
            // Find details of roommates
            const roommatesList = allocation.members.filter(m => m !== email);
            const roommatesDocs = await Profile.find({ user_id: { $in: roommatesList } });
            const activeRequest = await ChangeRequest.findOne({ studentId: email }).sort({ _id: -1 });
            
            return res.json({
                status: 'ALLOCATED',
                room_id: allocation._id,
                room_number: allocation.room_number || allocation.allocation_run_id,
                block: allocation.block,
                floor: allocation.floor,
                roommates: roommatesDocs.map(r => ({
                    name: r.name,
                    email: r.user_id,
                    branch: r.branch,
                    year: r.year_of_study
                })),
                changeRequestInfo: activeRequest ? { status: activeRequest.status } : null
            });
        }
        
        // 3. Not allocated yet
        return res.json({ status: 'PENDING_ALLOCATION', message: 'Allocation in progress. Please wait.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.submitPreferences = async (req, res) => {
    try {
        const payload = req.body; // should extract email from token normally, here body
        const email = payload.user_id;

        const existing = await Profile.findOne({ user_id: email });
        if (existing) {
            return res.status(400).json({ message: 'Form already submitted' });
        }

        const newProfile = new Profile(payload);
        await newProfile.save();

        await User.findOneAndUpdate({ email: email }, { isFormSubmitted: true });

        res.status(201).json({ message: 'Preferences saved successfully' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.submitChangeRequest = async (req, res) => {
    try {
        const { email, name, roomId, reason } = req.body;
        
        const newReq = new ChangeRequest({
            studentId: email,
            studentName: name,
            currentRoomId: roomId,
            reason: reason,
            status: 'Pending'
        });
        await newReq.save();
        res.status(201).json({ message: 'Request submitted to admin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};
