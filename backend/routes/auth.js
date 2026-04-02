const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Sync user from NextAuth to MongoDB
router.post('/sync-user', async (req, res) => {
    try {
        const { email, name, image, role = 'STU' } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Ensure email ends with @sitpune.edu.in
        if (!email.endsWith('@sitpune.edu.in') && !email.endsWith('sitpune.edu.in')) {
            return res.status(403).json({ error: 'Unauthorized domain.' });
        }

        const user = await User.findOneAndUpdate(
            { email },
            { name, avatarUrl: image, role },
            { upsert: true, new: true }
        );

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

module.exports = router;
