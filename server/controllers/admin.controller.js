const db = require('../config/db');
const { formatSqlDatetime } = require('../utils/helpers');

// GET /api/admin/dashboard-stats
async function getDashboardStats(req, res, next) {
  try {
    const [userCount] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'user'");
    const [locationCount] = await db.execute('SELECT COUNT(*) AS total FROM parking_locations WHERE is_active = 1');
    const [slotStats] = await db.execute(`
      SELECT 
        COUNT(*) AS total_slots,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_slots
      FROM parking_slots
      WHERE is_active = 1
    `);
    const [bookingStats] = await db.execute(`
      SELECT 
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN 1 ELSE 0 END) AS active_reservations,
        SUM(CASE WHEN booking_status = 'completed' THEN 1 ELSE 0 END) AS completed_reservations,
        SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_reservations,
        COALESCE(SUM(CASE WHEN booking_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS estimated_revenue
      FROM bookings
    `);

    res.status(200).json({
      success: true,
      data: {
        totalUsers: Number(userCount[0].total),
        totalLocations: Number(locationCount[0].total),
        slots: {
          total: Number(slotStats[0].total_slots || 0),
          available: Number(slotStats[0].available_slots || 0),
          occupied: Number(slotStats[0].occupied_slots || 0),
          maintenance: Number(slotStats[0].maintenance_slots || 0)
        },
        bookings: {
          total: Number(bookingStats[0].total_bookings || 0),
          active: Number(bookingStats[0].active_reservations || 0),
          completed: Number(bookingStats[0].completed_reservations || 0),
          cancelled: Number(bookingStats[0].cancelled_reservations || 0)
        },
        estimatedRevenue: Number(bookingStats[0].estimated_revenue || 0).toFixed(2)
      }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/bookings
async function getAllBookings(req, res, next) {
  try {
    const { status, locationId, search } = req.query;

    let sql = `
      SELECT 
        b.id, b.booking_code, b.start_time, b.end_time, b.total_amount,
        b.booking_status, b.vehicle_number, b.check_in_time, b.check_out_time,
        b.qr_code_data, b.created_at,
        u.id AS user_id, u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone,
        l.id AS location_id, l.name AS location_name, l.city, l.address AS location_address,
        l.latitude, l.longitude,
        s.id AS slot_id, s.slot_number, s.slot_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN parking_locations l ON b.location_id = l.id
      JOIN parking_slots s ON b.slot_id = s.id
      WHERE 1 = 1
    `;

    const params = [];

    if (status) {
      sql += ' AND b.booking_status = ?';
      params.push(status);
    }

    if (locationId) {
      sql += ' AND b.location_id = ?';
      params.push(locationId);
    }

    if (search) {
      sql += ' AND (b.booking_code LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR b.vehicle_number LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await db.execute(sql, params);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/bookings/:id/check-in
async function checkInBooking(req, res, next) {
  try {
    const bookingId = req.params.id;
    const nowIso = new Date().toISOString();
    const nowSql = formatSqlDatetime(nowIso);

    const [rows] = await db.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = rows[0];
    if (booking.booking_status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot check in a cancelled booking.' });
    }

    await db.execute(
      'UPDATE bookings SET check_in_time = ? WHERE id = ?',
      [nowSql, bookingId]
    );

    res.status(200).json({
      success: true,
      message: `Vehicle checked in at ${new Date(nowIso).toLocaleTimeString()}`,
      data: { bookingId, checkInTime: nowIso }
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/bookings/:id/check-out
async function checkOutBooking(req, res, next) {
  try {
    const bookingId = req.params.id;
    const nowIso = new Date().toISOString();
    const nowSql = formatSqlDatetime(nowIso);

    const [rows] = await db.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    await db.execute(
      "UPDATE bookings SET check_out_time = ?, booking_status = 'completed' WHERE id = ?",
      [nowSql, bookingId]
    );

    res.status(200).json({
      success: true,
      message: `Vehicle checked out at ${new Date(nowIso).toLocaleTimeString()}. Booking marked completed.`,
      data: { bookingId, checkOutTime: nowIso, status: 'completed' }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/reports
async function getReports(req, res, next) {
  try {
    // Location breakdown
    const [locationStats] = await db.execute(`
      SELECT 
        l.id, l.name, l.city, l.hourly_rate,
        COUNT(s.id) AS total_slots,
        SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS available_slots,
        SUM(CASE WHEN s.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_slots,
        SUM(CASE WHEN s.status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_slots,
        COALESCE((
          SELECT COUNT(*) FROM bookings b 
          WHERE b.location_id = l.id AND b.booking_status = 'confirmed'
        ), 0) AS active_reservations,
        COALESCE((
          SELECT SUM(total_amount) FROM bookings b 
          WHERE b.location_id = l.id AND b.booking_status != 'cancelled'
        ), 0) AS total_revenue
      FROM parking_locations l
      LEFT JOIN parking_slots s ON l.id = s.location_id AND s.is_active = 1
      WHERE l.is_active = 1
      GROUP BY l.id
    `);

    // Audit logs
    const [auditLogs] = await db.execute(`
      SELECT 
        a.id, a.old_status, a.new_status, a.reason, a.created_at,
        s.slot_number,
        l.name AS location_name,
        u.full_name AS changed_by_name
      FROM slot_audit_logs a
      JOIN parking_slots s ON a.slot_id = s.id
      JOIN parking_locations l ON s.location_id = l.id
      JOIN users u ON a.changed_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    res.status(200).json({
      success: true,
      data: {
        locations: locationStats,
        auditLogs
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/lifecycle-sweep
async function triggerLifecycleSweep(req, res, next) {
  try {
    const { processExpiredBookings } = require('../services/lifecycle.service');
    const result = await processExpiredBookings();
    res.status(200).json({
      success: true,
      message: `Lifecycle sweep completed. Processed ${result.processed || 0} expired booking(s).`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/notifications
async function getNotifications(req, res, next) {
  try {
    const { status, type, bookingCode, limit = 50, page = 1 } = req.query;

    let query = `
      SELECT
        id,
        booking_id,
        booking_code,
        recipient_email,
        notification_type,
        delivery_status,
        attempt_count,
        error_message,
        last_attempt_at,
        created_at,
        updated_at
      FROM notifications
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND delivery_status = ?`;
      params.push(status);
    }
    if (type) {
      query += ` AND notification_type = ?`;
      params.push(type);
    }
    if (bookingCode) {
      query += ` AND booking_code LIKE ?`;
      params.push(`%${bookingCode.trim()}%`);
    }

    query += ` ORDER BY last_attempt_at DESC LIMIT ? OFFSET ?`;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedOffset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * parsedLimit;
    params.push(parsedLimit, parsedOffset);

    const [rows] = await db.execute(query, params);

    // Map rows to include 'actionRequired' flag and sanitize recipient email partially (e.g. j***@example.com)
    const sanitizedRows = rows.map(r => {
      let maskedEmail = r.recipient_email;
      if (maskedEmail && maskedEmail.includes('@')) {
        const parts = maskedEmail.split('@');
        const userPart = parts[0];
        const domain = parts[1];
        maskedEmail = userPart.charAt(0) + '***@' + domain;
      }
      return {
        id: r.id,
        bookingId: r.booking_id,
        bookingCode: r.booking_code,
        recipientEmail: maskedEmail,
        notificationType: r.notification_type,
        deliveryStatus: r.delivery_status,
        attemptCount: Number(r.attempt_count),
        errorMessage: r.error_message,
        lastAttemptAt: r.last_attempt_at,
        createdAt: r.created_at,
        actionRequired: r.delivery_status === 'failed'
      };
    });

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM notifications`);
    const totalCount = Number(countRows[0]?.total || 0);

    res.status(200).json({
      success: true,
      count: sanitizedRows.length,
      total: totalCount,
      page: Number(page) || 1,
      data: sanitizedRows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
  getAllBookings,
  checkInBooking,
  checkOutBooking,
  getReports,
  triggerLifecycleSweep,
  getNotifications
};
