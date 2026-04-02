const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Student Dashboard - Get own allocation
router.get('/dashboard/:email', studentController.getDashboardData);

module.exports = router;
