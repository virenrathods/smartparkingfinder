const db = require('../config/db');
const { generateBookingCode, calculateDurationHours } = require('../utils/helpers');
const { generateBookingQRCode } = require('../utils/qrGenerator');
const emailService = require('../services/email.service');

// POST /api/bookings
async function createBooking(req, res, next) {
  const connection = await db.getConnection();
  try {
    const { location_id, slot_id, start_time, end_time, vehicle_number } = req.body;
    const userId = req.user.id;

    if (!location_id || !slot_id || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Location ID, slot ID, start time, and end time are required.'
      });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date/time format. Please provide valid ISO-8601 timestamps.'
      });
    }

    const nowEpoch = Date.now();
    // Allow 5-minute buffer for clock skew / submission latency
    if (startDate.getTime() < nowEpoch - 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reservation start time cannot be in the past.'
      });
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time.'
      });
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours < 0.5) {
      return res.status(400).json({
        success: false,
        message: 'Minimum booking duration is 30 minutes.'
      });
    }

    if (durationHours > 72) {
      return res.status(400).json({
        success: false,
        message: 'Maximum single booking duration cannot exceed 72 hours.'
      });
    }

    // Begin ACID transaction
    await connection.beginTransaction();

    // 1. Lock and inspect slot record
    const [slotRows] = await connection.execute(
      'SELECT id, location_id, slot_number, slot_type, status, is_active FROM parking_slots WHERE id = ? FOR UPDATE',
      [slot_id]
    );

    if (slotRows.length === 0 || !slotRows[0].is_active) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Selected parking slot does not exist or is inactive.'
      });
    }

    const slot = slotRows[0];

    if (slot.location_id !== Number(location_id)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Slot does not belong to the selected parking facility.'
      });
    }

    if (slot.status === 'maintenance') {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This slot is currently under maintenance and cannot be reserved.'
      });
    }

    if (slot.status === 'occupied') {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This slot is currently occupied.'
      });
    }

    // 2. Concurrency-safe overlap check
    const [conflicts] = await connection.execute(
      `SELECT id, booking_code FROM bookings 
       WHERE slot_id = ? 
         AND booking_status = 'confirmed' 
         AND (start_time < ? AND end_time > ?)
       FOR UPDATE`,
      [slot_id, endDate.toISOString(), startDate.toISOString()]
    );

    if (conflicts.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'Collision detected: This slot was just booked by another driver for this time window. Please pick another slot.'
      });
    }

    // 3. Fetch location rates
    const [locationRows] = await connection.execute(
      'SELECT name, address, hourly_rate FROM parking_locations WHERE id = ?',
      [location_id]
    );

    if (locationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Parking facility not found.' });
    }

    const location = locationRows[0];
    const hours = calculateDurationHours(startDate, endDate);
    const totalAmount = (hours * Number(location.hourly_rate)).toFixed(2);

    // 4. Generate unique booking reference and real QR code
    const bookingCode = generateBookingCode();
    const qrPayload = {
      system: 'SmartParkingFinder',
      ticket: bookingCode,
      user_id: userId,
      location: location.name,
      slot: slot.slot_number,
      vehicle: vehicle_number || 'N/A',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      amount: totalAmount
    };

    const qrCodeDataUrl = await generateBookingQRCode(qrPayload);

    // 5. Insert reservation into bookings table
    const [bookingResult] = await connection.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, vehicle_number, qr_code_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
      [
        bookingCode,
        userId,
        location_id,
        slot_id,
        startDate.toISOString(),
        endDate.toISOString(),
        totalAmount,
        vehicle_number ? vehicle_number.trim().toUpperCase() : null,
        qrCodeDataUrl
      ]
    );

    // Commit transaction
    await connection.commit();

    // Fetch user details for confirmation email
    let userDetails = { full_name: 'Driver', email: req.user.email };
    try {
      const [userRows] = await db.execute('SELECT full_name, email FROM users WHERE id = ?', [userId]);
      if (userRows && userRows.length > 0) {
        userDetails = userRows[0];
      }
    } catch (uErr) {
      console.warn('[Booking] Could not fetch user details for email:', uErr.message);
    }

    // Safely dispatch confirmation email without blocking or failing booking
    let notificationInfo = null;
    try {
      notificationInfo = await emailService.sendBookingConfirmation({
        booking: {
          id: bookingResult.insertId,
          booking_code: bookingCode,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          total_amount: totalAmount,
          vehicle_number: vehicle_number || null
        },
        user: userDetails,
        location,
        slot
      });
    } catch (emailErr) {
      console.error('[Booking] Non-fatal confirmation email error:', emailErr.message);
      notificationInfo = { success: false, error: emailErr.message };
    }

    res.status(201).json({
      success: true,
      message: 'Parking slot successfully reserved!',
      data: {
        bookingId: bookingResult.insertId,
        bookingCode,
        locationName: location.name,
        slotNumber: slot.slot_number,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        durationHours: hours,
        hourlyRate: location.hourly_rate,
        totalAmount,
        vehicleNumber: vehicle_number || null,
        qrCodeDataUrl,
        notification: notificationInfo
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

// GET /api/bookings/my
async function getMyBookings(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT 
        b.id, b.booking_code, b.start_time, b.end_time, b.total_amount,
        b.booking_status, b.vehicle_number, b.check_in_time, b.check_out_time,
        b.qr_code_data, b.created_at,
        l.id AS location_id, l.name AS location_name, l.address AS location_address, l.city,
        l.latitude, l.longitude,
        s.id AS slot_id, s.slot_number, s.slot_type
      FROM bookings b
      JOIN parking_locations l ON b.location_id = l.id
      JOIN parking_slots s ON b.slot_id = s.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
async function getBookingById(req, res, next) {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const [rows] = await db.execute(
      `SELECT 
        b.*,
        u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone,
        l.name AS location_name, l.address AS location_address, l.city, l.hourly_rate,
        l.latitude, l.longitude,
        s.slot_number, s.slot_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN parking_locations l ON b.location_id = l.id
      JOIN parking_slots s ON b.slot_id = s.id
      WHERE b.id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking ticket not found.' });
    }

    const booking = rows[0];

    // Ownership or admin check
    if (!isAdmin && booking.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied to this booking.' });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id/cancel
async function cancelBooking(req, res, next) {
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const [rows] = await db.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];

    if (!isAdmin && booking.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own bookings.' });
    }

    if (booking.booking_status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }

    if (booking.booking_status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed booking.' });
    }

    // Cancel booking and free the slot immediately
    await db.execute(
      "UPDATE bookings SET booking_status = 'cancelled' WHERE id = ?",
      [bookingId]
    );

    // Asynchronously dispatch cancellation confirmation email
    let notificationInfo = null;
    try {
      const [details] = await db.execute(
        `SELECT b.*, u.full_name, u.email, l.name AS location_name, l.address, l.city, s.slot_number
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         JOIN parking_locations l ON b.location_id = l.id
         JOIN parking_slots s ON b.slot_id = s.id
         WHERE b.id = ?`,
        [bookingId]
      );
      if (details && details.length > 0) {
        const b = details[0];
        notificationInfo = await emailService.sendCancellationEmail({
          booking: b,
          user: { full_name: b.full_name, email: b.email },
          location: { name: b.location_name, address: b.address, city: b.city },
          slot: { slot_number: b.slot_number }
        });
      }
    } catch (emailErr) {
      console.error('[Booking] Non-fatal cancellation email error:', emailErr.message);
      notificationInfo = { success: false, error: emailErr.message };
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Slot is now released and available for other drivers.',
      data: { bookingId, status: 'cancelled', notification: notificationInfo }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
};
