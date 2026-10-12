const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slot.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

// Admin-only endpoints for direct slot management
router.patch('/:id/status', authenticateToken, requireAdmin, slotController.updateSlotStatus);
router.delete('/:id', authenticateToken, requireAdmin, slotController.deleteSlot);

module.exports = router;
