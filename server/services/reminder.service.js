const db = require('../config/db');
const emailService = require('./email.service');
const { formatSqlDatetime } = require('../utils/helpers');

let isRunning = false;
let intervalId = null;

/**
 * Sweeps the database for confirmed reservations starting within the reminder window
 * and dispatches notification reminders.
 *
 * Requirements satisfied:
 * - Only confirmed future bookings receive reminders (start_time > now).
 * - Cancelled, completed, or expired bookings are excluded.
 * - Idempotent: Bookings with an existing 'sent' or 'skipped' reminder are excluded.
 * - Recovery Policy: Reservations that have already started or ended while offline
 *   are NEVER sent an outdated "starting soon" reminder.
 * - Overlap guard prevents concurrent execution.
 *
 * @param {Date|string} [referenceTime=new Date()]
 * @returns {Promise<{ processed: number, reminders: Array<object>, skipped?: boolean, error?: string }>}
 */
async function processReminders(referenceTime = new Date()) {
  if (isRunning) {
    console.log('[Reminder] Task already running, skipping overlapping execution.');
    return { processed: 0, reminders: [], skipped: true };
  }

  isRunning = true;
  const now = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
  const reminderMinutes = Number(process.env.REMINDER_MINUTES_BEFORE) || 15;
  const windowEnd = new Date(now.getTime() + reminderMinutes * 60 * 1000);
  const nowSql = formatSqlDatetime(now);
  const windowEndSql = formatSqlDatetime(windowEnd);

  try {
    const [eligibleBookings] = await db.execute(
      `SELECT 
        b.id, b.booking_code, b.start_time, b.end_time, b.total_amount, b.vehicle_number,
        u.id AS user_id, u.email, u.full_name,
        l.id AS location_id, l.name AS location_name, l.address, l.city,
        s.id AS slot_id, s.slot_number, s.slot_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN parking_locations l ON b.location_id = l.id
      JOIN parking_slots s ON b.slot_id = s.id
      WHERE b.booking_status = 'confirmed'
        AND b.start_time > ?
        AND b.start_time <= ?
        AND NOT EXISTS (
          SELECT 1 FROM notifications n 
          WHERE n.booking_id = b.id 
            AND n.notification_type = 'reminder' 
            AND (
              n.delivery_status = 'sent' 
              OR n.delivery_status = 'skipped' 
              OR (n.delivery_status = 'failed' AND n.attempt_count >= 3)
            )
        )`,
      [nowSql, windowEndSql]
    );

    if (!eligibleBookings || eligibleBookings.length === 0) {
      return { processed: 0, reminders: [] };
    }

    const dispatched = [];

    for (const b of eligibleBookings) {
      const result = await emailService.sendBookingReminder({
        booking: {
          id: b.id,
          booking_code: b.booking_code,
          start_time: b.start_time,
          end_time: b.end_time,
          vehicle_number: b.vehicle_number
        },
        user: {
          email: b.email,
          full_name: b.full_name
        },
        location: {
          name: b.location_name,
          address: b.address,
          city: b.city
        },
        slot: {
          slot_number: b.slot_number,
          slot_type: b.slot_type
        }
      });

      dispatched.push({
        bookingId: b.id,
        bookingCode: b.booking_code,
        recipient: b.email,
        result
      });
    }

    console.log(`[Reminder] Processed ${dispatched.length} reminder notification(s).`);
    return { processed: dispatched.length, reminders: dispatched };
  } catch (err) {
    console.error('[Reminder] Error processing reminders:', err.message);
    return { processed: 0, reminders: [], error: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the periodic background reminder service.
 *
 * @param {number} [intervalMs=60000] - Polling interval in milliseconds (default: 60s)
 */
function startReminderService(intervalMs = 60000) {
  // Execute initial sweep on startup
  processReminders().catch(err => {
    console.error('[Reminder] Startup sweep error:', err.message);
  });

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(() => {
    processReminders().catch(err => {
      console.error('[Reminder] Periodic reminder sweep error:', err.message);
    });
  }, intervalMs);

  if (intervalId && intervalId.unref) {
    intervalId.unref();
  }

  console.log(`[Reminder] Background booking reminder service active (interval: ${intervalMs / 1000}s)`);
}

/**
 * Cleanly stops the background reminder monitor.
 */
function stopReminderService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Reminder] Background booking reminder service stopped.');
  }
}

module.exports = {
  processReminders,
  startReminderService,
  stopReminderService
};
