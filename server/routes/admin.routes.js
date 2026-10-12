const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/bookings', adminController.getAllBookings);
router.patch('/bookings/:id/check-in', adminController.checkInBooking);
router.patch('/bookings/:id/check-out', adminController.checkOutBooking);
router.get('/reports', adminController.getReports);

module.exports = router;
