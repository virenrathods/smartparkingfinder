const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const slotController = require('../controllers/slot.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

// Public endpoints
router.get('/', locationController.getAllLocations);
router.get('/:id', locationController.getLocationById);
router.get('/:id/slots', slotController.getSlotsByLocation);

// Admin-only endpoints
router.post('/', authenticateToken, requireAdmin, locationController.createLocation);
router.put('/:id', authenticateToken, requireAdmin, locationController.updateLocation);
router.delete('/:id', authenticateToken, requireAdmin, locationController.deleteLocation);
router.post('/:id/slots', authenticateToken, requireAdmin, slotController.createSlot);

module.exports = router;
