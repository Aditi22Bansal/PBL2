const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Sync Google Sheets CSV
router.post('/sync-csv', adminController.syncCsv);

// Trigger Python Allocation engine
router.post('/trigger-allocation', adminController.triggerAllocation);

// Get results
router.get('/allocations', adminController.getAllocations);

module.exports = router;
