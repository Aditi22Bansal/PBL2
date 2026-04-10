const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Sync Google Sheets CSV (Legacy, can keep it)
router.post('/sync-csv', adminController.syncCsv);

// Trigger Python Allocation engine
router.post('/trigger-allocation', adminController.triggerAllocation);

// Get results
router.get('/allocations', adminController.getAllocations);

// Manually modify assignments
router.post('/allocations/manual-swap', adminController.manualSwap);

// Export CSV Report
router.get('/allocations/report', adminController.downloadReport);

// Toggle room lock
router.post('/allocations/toggle-lock', adminController.toggleRoomLock);

// Room change requests endpoints
router.get('/requests', adminController.getChangeRequests);
router.post('/requests/action', adminController.handleRequestAction);

// Force allocate remaining unassigned students
router.post('/force-allocate', adminController.forceAllocateRemaining);

module.exports = router;
