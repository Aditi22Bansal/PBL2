const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { requireAuth } = require('../middleware/requireAuth');

// Every student route requires a real, server-verified identity.
router.use(requireAuth);

// Student Dashboard - Get own allocation. No :email param - always the
// verified caller's own dashboard, never anyone else's.
router.get('/dashboard', studentController.getDashboardData);

// Profile management routes
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.saveProfile);
router.post('/profile/submit', studentController.submitProfile);

// Room change requests
router.post('/change-request', studentController.submitChangeRequest);

// In-app notifications (own, unread)
router.get('/notifications', studentController.getNotifications);
router.post('/notifications/read', studentController.markNotificationsRead);

module.exports = router;
