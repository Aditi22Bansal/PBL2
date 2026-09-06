const User = require('../models/User');

// Requires the X-User-Email header (set only by the frontend's server-side proxy
// after verifying the real NextAuth session — never trust it if it arrived any
// other way) and looks up the actual User document, so req.currentUser.role is
// always a real DB value, never something a client could assert directly.
const requireAuth = async (req, res, next) => {
    try {
        const email = req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({ error: 'Unauthorized: X-User-Email header missing' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: no account found for this email' });
        }

        req.currentUser = {
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId
        };

        next();
    } catch (error) {
        console.error('requireAuth error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Must run after requireAuth. Reads role from req.currentUser, which came from
// the DB lookup above — never from a header or any client-supplied value.
const requireAdmin = (req, res, next) => {
    if (!req.currentUser) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.currentUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: admin role required' });
    }
    next();
};

module.exports = { requireAuth, requireAdmin };
