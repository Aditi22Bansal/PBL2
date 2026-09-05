const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Organization = require('../models/Organization');

// Sync user from NextAuth to MongoDB
router.post('/sync-user', async (req, res) => {
    try {
        // role is deliberately NEVER read from req.body - it used to be
        // client-supplied here (and re-written on every login via the
        // upsert below), which meant anyone could self-escalate to ADMIN
        // just by setting a cookie/form field before signing in. A brand
        // new user is always created as STUDENT; becoming an ADMIN happens
        // only through the founding-admin org-onboarding flow or a direct
        // DB promotion - never through login.
        const { email, name, image } = req.body;

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

        // $set only ever touches fields that are legitimately re-syncable on
        // every login (display name/avatar can change upstream; org
        // membership should track the domain mapping if it's ever
        // reconfigured). $setOnInsert applies ONLY when this upsert actually
        // creates a brand-new document - never on an existing user - so an
        // existing account's role can no longer be overwritten by anything
        // sent from the client, ever.
        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: { name, avatarUrl: image, organizationId: organization._id },
                $setOnInsert: { role: 'STUDENT' }
            },
            { upsert: true, new: true }
        );

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

module.exports = router;
