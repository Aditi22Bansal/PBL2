const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

exports.getDashboardData = async (req, res) => {
    try {
        const email = req.currentUser.email;

        const dashboardService = require('../services/studentDashboardService');
        const payload = await dashboardService.getDashboardDTO(email, req.currentUser.organizationId);
        res.json(payload);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

// GET /api/student/profile
exports.getProfile = async (req, res) => {
    try {
        const email = req.currentUser.email;

        const profile = await Profile.findOne({ user_id: email, organizationId: req.currentUser.organizationId });
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
        const email = req.currentUser.email;
        const organizationId = req.currentUser.organizationId;

        const updateData = {
            ...req.body,
            user_id: email,
            organizationId,
            profileCompleted: false,
            lastEditedAt: new Date()
        };

        // Don't overwrite email
        delete updateData.email;

        const profile = await Profile.findOneAndUpdate(
            { user_id: email, organizationId },
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
        const email = req.currentUser.email;
        const organizationId = req.currentUser.organizationId;

        const updateData = {
            ...req.body,
            user_id: email,
            organizationId,
            profileCompleted: true,
            submittedAt: new Date(),
            lastEditedAt: new Date()
        };

        // Don't overwrite email
        delete updateData.email;

        const profile = await Profile.findOneAndUpdate(
            { user_id: email, organizationId },
            { $set: updateData },
            { new: true, upsert: true }
        );
        res.json(profile);
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
        const { roomId, reason, requestType, requestedAccommodation } = req.body;
        const email = req.currentUser.email;
        const name = req.currentUser.name;

        const type = requestType === 'ACCESSIBILITY' ? 'ACCESSIBILITY' : 'GENERAL';
        if (type === 'ACCESSIBILITY' && !requestedAccommodation) {
            return res.status(400).json({ error: 'requestedAccommodation is required for an ACCESSIBILITY request' });
        }

        const newReq = new ChangeRequest({
            organizationId: req.currentUser.organizationId,
            studentId: email,
            studentName: name,
            currentRoomId: roomId,
            reason: reason || '',
            requestType: type,
            requestedAccommodation: type === 'ACCESSIBILITY' ? requestedAccommodation : '',
            status: 'Pending'
        });
        await newReq.save();
        res.status(201).json({ message: 'Request submitted to admin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// GET /api/student/notifications - unread only; the caller's own, never
// anyone else's (email comes from the verified session via requireAuth).
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            recipient_email: req.currentUser.email,
            organizationId: req.currentUser.organizationId,
            read: false
        }).sort({ createdAt: -1 }).lean();

        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// POST /api/student/notifications/read - marks the caller's unread
// notifications as seen. Scoped to their own email, so one student can never
// clear another's.
exports.markNotificationsRead = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            {
                recipient_email: req.currentUser.email,
                organizationId: req.currentUser.organizationId,
                read: false
            },
            { $set: { read: true } }
        );

        res.json({ message: 'Notifications marked as read', modified: result.modifiedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};
