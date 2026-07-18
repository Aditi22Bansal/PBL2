const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Student Dashboard - Get own allocation
router.get('/dashboard/:email', studentController.getDashboardData);

// Profile management routes
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.saveProfile);
router.post('/profile/submit', studentController.submitProfile);

module.exports = router;
