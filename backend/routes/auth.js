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

// Creates a brand-new Organization + its founding ADMIN User. Public (no
// requireAuth) - by definition there's no existing admin to authenticate as
// yet. Rejects if the domain is already claimed, and requires the founder's
// own email to actually belong to the domain being registered (otherwise
// anyone could register any org under any email, defeating the whole point
// of domain-gating). After this, the founder just logs in normally through
// the regular flow - sync-user above will find their User document already
// exists and, per its $set/$setOnInsert split, will never touch the ADMIN
// role this endpoint gave them.
//
// This Mongo deployment is a standalone instance (no replica set - see
// manualSwap's comment in adminController.js for how that was confirmed),
// so multi-document transactions aren't available. Safest achievable
// ordering instead: Organization first, then the founding User; if the User
// insert fails for any reason, the just-created Organization (which has no
// dependents yet - nothing else could reference it in the time between
// these two calls) is deleted as a compensating rollback, so a failed
// registration never leaves a stranded org with nobody able to administer it.
router.post('/register-organization', async (req, res) => {
    try {
        const { orgName, domain, founderName, founderEmail } = req.body;

        if (!orgName || !domain || !founderName || !founderEmail) {
            return res.status(400).json({ error: 'orgName, domain, founderName, and founderEmail are all required.' });
        }

        const cleanDomain = domain.trim().toLowerCase().replace(/^@/, '');
        const founderDomain = (founderEmail.split('@')[1] || '').toLowerCase();

        if (!cleanDomain || founderDomain !== cleanDomain) {
            return res.status(400).json({ error: `founderEmail must belong to the ${cleanDomain || 'domain'} being registered.` });
        }

        // Friendly pre-checks before attempting the insert - the unique
        // indexes below are the REAL enforcement (a race between two
        // concurrent registrations is still caught, via the catch blocks),
        // these just avoid a raw duplicate-key error as the first thing a
        // legitimate user sees.
        const existingOrg = await Organization.findOne({ allowedEmailDomains: cleanDomain });
        if (existingOrg) {
            return res.status(409).json({ error: `The domain ${cleanDomain} is already registered to an organization. Please log in instead.` });
        }
        const existingUser = await User.findOne({ email: founderEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
        }

        // Derived from the domain (already guaranteed unique) rather than
        // orgName (which isn't), so slug uniqueness comes for free with no
        // extra dedup logic.
        const slug = cleanDomain.replace(/[^a-z0-9]+/g, '-');

        let org;
        try {
            org = await Organization.create({
                name: orgName,
                slug,
                allowedEmailDomains: [cleanDomain]
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ error: `The domain ${cleanDomain} is already registered to an organization. Please log in instead.` });
            }
            throw err;
        }

        let founder;
        try {
            founder = await User.create({
                email: founderEmail,
                name: founderName,
                role: 'ADMIN',
                organizationId: org._id
            });
        } catch (err) {
            await Organization.deleteOne({ _id: org._id });
            if (err.code === 11000) {
                return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
            }
            throw err;
        }

        res.status(201).json({
            message: 'Organization created successfully.',
            organization: { _id: org._id, name: org.name, slug: org.slug, allowedEmailDomains: org.allowedEmailDomains },
            founder: { _id: founder._id, email: founder.email, name: founder.name, role: founder.role }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to register organization' });
    }
});

module.exports = router;
