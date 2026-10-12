const db = require('../config/db');

// GET /api/locations/:id/slots
// Query params: startTime, endTime (ISO strings)
async function getSlotsByLocation(req, res, next) {
  try {
    const locationId = req.params.id;
    const { startTime, endTime } = req.query;

    const [slots] = await db.execute(
      `SELECT id, location_id, slot_number, slot_type, status, is_active, created_at
       FROM parking_slots
       WHERE location_id = ? AND is_active = 1
       ORDER BY slot_number ASC`,
      [locationId]
    );

    // If time window is supplied, calculate dynamic availability
    if (startTime && endTime) {
      const [conflicts] = await db.execute(
        `SELECT slot_id, booking_code, start_time, end_time 
         FROM bookings 
         WHERE location_id = ? 
           AND booking_status = 'confirmed'
           AND (start_time < ? AND end_time > ?)`,
        [locationId, endTime, startTime]
      );

      const conflictMap = new Set(conflicts.map(c => c.slot_id));

      const annotatedSlots = slots.map(slot => {
        const isBookedInWindow = conflictMap.has(slot.id);
        const isUnderMaintenance = slot.status === 'maintenance';
        const isManuallyOccupied = slot.status === 'occupied';

        let effectiveStatus = slot.status;
        let isAvailable = true;
        let reason = 'Available for reservation';

        if (isUnderMaintenance) {
          isAvailable = false;
          effectiveStatus = 'maintenance';
          reason = 'Slot is currently closed for maintenance';
        } else if (isManuallyOccupied) {
          isAvailable = false;
          effectiveStatus = 'occupied';
          reason = 'Slot is manually marked as occupied by operator';
        } else if (isBookedInWindow) {
          isAvailable = false;
          effectiveStatus = 'reserved';
          reason = 'Slot is already booked for this time window';
        }

        return {
          ...slot,
          effectiveStatus,
          isAvailable,
          reason
        };
      });

      return res.status(200).json({
        success: true,
        count: annotatedSlots.length,
        timeWindow: { startTime, endTime },
        data: annotatedSlots
      });
    }

    // Default response when no specific time range provided
    const defaultAnnotated = slots.map(slot => ({
      ...slot,
      effectiveStatus: slot.status,
      isAvailable: slot.status === 'available',
      reason: slot.status === 'available' ? 'Available' : `Slot status: ${slot.status}`
    }));

    res.status(200).json({
      success: true,
      count: defaultAnnotated.length,
      data: defaultAnnotated
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/locations/:id/slots (Admin)
async function createSlot(req, res, next) {
  try {
    const locationId = req.params.id;
    const { slot_number, slot_type } = req.body;

    if (!slot_number) {
      return res.status(400).json({ success: false, message: 'Slot number is required.' });
    }

    // Check duplicate
    const [existing] = await db.execute(
      'SELECT id FROM parking_slots WHERE location_id = ? AND slot_number = ?',
      [locationId, slot_number.trim().toUpperCase()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A slot with this number already exists at this location.' });
    }

    const [result] = await db.execute(
      'INSERT INTO parking_slots (location_id, slot_number, slot_type, status, is_active) VALUES (?, ?, ?, ?, 1)',
      [locationId, slot_number.trim().toUpperCase(), slot_type || 'car', 'available']
    );

    // Update total_slots in location
    await db.execute(
      'UPDATE parking_locations SET total_slots = (SELECT COUNT(*) FROM parking_slots WHERE location_id = ? AND is_active = 1) WHERE id = ?',
      [locationId, locationId]
    );

    res.status(201).json({
      success: true,
      message: 'Parking slot created successfully.',
      data: { id: result.insertId, slot_number: slot_number.trim().toUpperCase() }
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/slots/:id/status (Admin manual override)
async function updateSlotStatus(req, res, next) {
  try {
    const slotId = req.params.id;
    const { status, reason } = req.body;
    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const [existing] = await db.execute('SELECT status, location_id FROM parking_slots WHERE id = ?', [slotId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }

    const oldStatus = existing[0].status;

    await db.execute('UPDATE parking_slots SET status = ? WHERE id = ?', [status, slotId]);

    // Record audit log
    await db.execute(
      'INSERT INTO slot_audit_logs (slot_id, changed_by, old_status, new_status, reason) VALUES (?, ?, ?, ?, ?)',
      [slotId, req.user.id, oldStatus, status, reason || 'Manual admin override']
    );

    res.status(200).json({
      success: true,
      message: `Slot status updated from ${oldStatus} to ${status}.`,
      data: { slotId, oldStatus, newStatus: status }
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/slots/:id (Admin)
async function deleteSlot(req, res, next) {
  try {
    const slotId = req.params.id;

    // Check active bookings
    const [bookings] = await db.execute(
      "SELECT id FROM bookings WHERE slot_id = ? AND booking_status = 'confirmed'",
      [slotId]
    );

    if (bookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete slot with active confirmed bookings.'
      });
    }

    const [slotRows] = await db.execute('SELECT location_id FROM parking_slots WHERE id = ?', [slotId]);
    if (slotRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found.' });
    }
    const locationId = slotRows[0].location_id;

    await db.execute('DELETE FROM parking_slots WHERE id = ?', [slotId]);

    // Update location total_slots
    await db.execute(
      'UPDATE parking_locations SET total_slots = (SELECT COUNT(*) FROM parking_slots WHERE location_id = ? AND is_active = 1) WHERE id = ?',
      [locationId, locationId]
    );

    res.status(200).json({
      success: true,
      message: 'Slot removed successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSlotsByLocation,
  createSlot,
  updateSlotStatus,
  deleteSlot
};
