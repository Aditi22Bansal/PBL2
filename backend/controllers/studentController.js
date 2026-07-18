const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');

exports.getDashboardData = async (req, res) => {
    try {
        const email = req.headers['x-user-email'] || req.params.email;
        if (!email) {
            return res.status(400).json({ error: 'Email parameter or X-User-Email header is required.' });
        }
        
        // 1. Check if student has submitted form
        const profile = await Profile.findOne({ user_id: email });
        if (!profile || profile.profileCompleted === false) {
            return res.json({ 
                status: 'NOT_SUBMITTED', 
                message: 'You have not submitted the preference form.',
                isDraft: !!profile
            });
        }
        
        // 2. Check if student is allocated
        const allocation = await RoomAllocation.findOne({ members: email });
        if (allocation) {
            // Find details of roommates
            const roommatesList = allocation.members.filter(m => m !== email);
            const roommatesDocs = await Profile.find({ user_id: { $in: roommatesList } });
            
            return res.json({
                status: 'ALLOCATED',
                room_id: allocation._id,
                room_number: allocation.room_number || allocation.allocation_run_id,
                roommates: roommatesDocs.map(r => ({
                    name: r.name,
                    email: r.user_id,
                    branch: r.branch,
                    year: r.year_of_study
                }))
            });
        }
        
        // 3. Not allocated yet
        return res.json({ status: 'PENDING_ALLOCATION', message: 'Allocation in progress. Please wait.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

// GET /api/student/profile
exports.getProfile = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized: X-User-Email header missing' });
        }

        const profile = await Profile.findOne({ user_id: email });
        if (!profile) {
            return res.json({ user_id: email, profileCompleted: false });
        }
        res.json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

// PUT /api/student/profile
exports.saveProfile = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized: X-User-Email header missing' });
        }

        const updateData = {
            ...req.body,
            user_id: email,
            profileCompleted: false,
            lastEditedAt: new Date()
        };

        // Don't overwrite email
        delete updateData.email;

        const profile = await Profile.findOneAndUpdate(
            { user_id: email },
            { $set: updateData },
            { new: true, upsert: true }
        );
        res.json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

// POST /api/student/profile/submit
exports.submitProfile = async (req, res) => {
    try {
        const email = req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized: X-User-Email header missing' });
        }

        const updateData = {
            ...req.body,
            user_id: email,
            profileCompleted: true,
            submittedAt: new Date(),
            lastEditedAt: new Date()
        };

        // Don't overwrite email
        delete updateData.email;

        const profile = await Profile.findOneAndUpdate(
            { user_id: email },
            { $set: updateData },
            { new: true, upsert: true }
        );
        res.json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};
