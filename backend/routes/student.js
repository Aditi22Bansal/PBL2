const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Student Dashboard - Get own allocation
router.get('/dashboard/:email', studentController.getDashboardData);

// Submit form
router.post('/preferences', studentController.submitPreferences);

// Submit change request
router.post('/change-request', studentController.submitChangeRequest);

module.exports = router;
