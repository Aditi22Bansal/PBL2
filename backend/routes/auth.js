const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Organization = require('../models/Organization');

// Sync user from NextAuth to MongoDB
router.post('/sync-user', async (req, res) => {
    try {
        const { email, name, image, role = 'STU' } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Resolve tenant membership from the email's domain instead of a
        // hardcoded @sitpune.edu.in check. DEV_AUTH only lets the frontend's
        // dev-login flow skip requiring a real password upstream - it does
        // NOT skip this: a dev-auth login still has to belong to a real,
        // registered organization's domain, same as production would.
        const emailDomain = email.split('@')[1] || '';
        const organization = await Organization.findOne({ allowedEmailDomains: emailDomain });

        if (!organization) {
            return res.status(403).json({ error: 'Unauthorized domain.' });
        }

        const user = await User.findOneAndUpdate(
            { email },
            { name, avatarUrl: image, role, organizationId: organization._id },
            { upsert: true, new: true }
        );

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

module.exports = router;
