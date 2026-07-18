const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const hostelConfigController = require('../controllers/hostelConfigController');

// Sync Google Sheets CSV
router.post('/sync-csv', adminController.syncCsv);

// Trigger Python Allocation engine
router.post('/trigger-allocation', adminController.triggerAllocation);

// Get results
router.get('/allocations', adminController.getAllocations);
router.get('/submission-stats', adminController.getSubmissionStats);

// Hostel Configurations CRUD routes
router.get('/hostel-configurations', hostelConfigController.getHostelConfigurations);
router.get('/hostel-configurations/:id', hostelConfigController.getHostelConfigurationById);
router.post('/hostel-configurations', hostelConfigController.createHostelConfiguration);
router.put('/hostel-configurations/:id', hostelConfigController.updateHostelConfiguration);
router.delete('/hostel-configurations/:id', hostelConfigController.deleteHostelConfiguration);
router.patch('/hostel-configurations/:id/activate', hostelConfigController.activateHostelConfiguration);

module.exports = router;
