const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const hostelConfigController = require('../controllers/hostelConfigController');
const { requireAuth, requireAdmin } = require('../middleware/requireAuth');

// Every admin route requires a real, server-verified identity AND an actual
// ADMIN role looked up from the User collection - never a client-asserted one.
router.use(requireAuth, requireAdmin);

// Sync Google Sheets CSV (Legacy, can keep it)
router.post('/sync-csv', adminController.syncCsv);

// Trigger Python Allocation engine
router.post('/trigger-allocation', adminController.triggerAllocation);

// Get results
router.get('/allocations', adminController.getAllocations);
router.get('/submission-stats', adminController.getSubmissionStats);
router.get('/analytics', adminController.getAnalytics);

// Hostel Configurations CRUD routes
router.get('/hostel-configurations', hostelConfigController.getHostelConfigurations);
router.get('/hostel-configurations/:id', hostelConfigController.getHostelConfigurationById);
router.post('/hostel-configurations', hostelConfigController.createHostelConfiguration);
router.put('/hostel-configurations/:id', hostelConfigController.updateHostelConfiguration);
router.delete('/hostel-configurations/:id', hostelConfigController.deleteHostelConfiguration);
router.patch('/hostel-configurations/:id/activate', hostelConfigController.activateHostelConfiguration);

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
