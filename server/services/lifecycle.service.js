const db = require('../config/db');
const { formatSqlDatetime } = require('../utils/helpers');

let isRunning = false;
let intervalId = null;

/**
 * Automatically transitions elapsed reservations according to check-in status:
 *
 * Rules:
 * - Only affects bookings with booking_status = 'confirmed' where end_time <= now.
 * - If vehicle checked in (check_in_time IS NOT NULL) and end_time elapsed:
 *   transitions to 'completed' and records check_out_time = end_time if not already set.
 * - If vehicle never checked in (check_in_time IS NULL) and end_time elapsed:
 *   transitions to 'expired' (no-show/unattended reservation).
 * - An actively checked-in vehicle whose end_time has NOT passed is NEVER completed prematurely.
 * - Future reservations (start_time > now) are NEVER modified.
 * - Cancelled reservations are NEVER altered or resurrected.
 * - Safe to execute repeatedly (idempotent).
 * - Concurrency guard prevents overlapping executions.
 *
 * @param {Date|string} [referenceTime=new Date()]
 * @returns {Promise<{ processed: number, updatedIds: Array<{id: number, code: string, status: string}>, skipped?: boolean, error?: string }>}
 */
async function processExpiredBookings(referenceTime = new Date()) {
  if (isRunning) {
    console.log('[Lifecycle] Task already running, skipping overlapping execution.');
    return { processed: 0, updatedIds: [], skipped: true };
  }

  isRunning = true;
  const nowSql = formatSqlDatetime(referenceTime);

  try {
    // 1. Identify reservations whose window has ended and status is still 'confirmed'
    const [expiredRows] = await db.execute(
      `SELECT id, booking_code, slot_id, location_id, start_time, end_time, check_in_time, check_out_time
       FROM bookings
       WHERE booking_status = 'confirmed' AND end_time <= ?`,
      [nowSql]
    );

    if (!expiredRows || expiredRows.length === 0) {
      return { processed: 0, updatedIds: [] };
    }

    const updatedIds = [];
    const updatedRecords = [];

    for (const b of expiredRows) {
      const hasCheckedIn = b.check_in_time !== null && b.check_in_time !== undefined && String(b.check_in_time).trim() !== '';
      const targetStatus = hasCheckedIn ? 'completed' : 'expired';

      await db.execute(
        `UPDATE bookings
         SET booking_status = ?,
             check_out_time = COALESCE(check_out_time, CASE WHEN check_in_time IS NOT NULL THEN ? ELSE NULL END),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND booking_status = 'confirmed'`,
        [targetStatus, b.end_time, b.id]
      );
      updatedIds.push(b.id);
      updatedRecords.push({ id: b.id, code: b.booking_code, status: targetStatus });
    }

    console.log(`[Lifecycle] Successfully updated ${updatedIds.length} elapsed booking(s):`, 
      updatedRecords.map(u => `${u.code} -> ${u.status}`).join(', ')
    );
    return { processed: updatedIds.length, updatedIds, updatedRecords };
  } catch (err) {
    console.error('[Lifecycle] Error during booking lifecycle sweep:', err.message);
    return { processed: 0, updatedIds: [], error: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the periodic background booking lifecycle monitor.
 *
 * @param {number} [intervalMs=60000] - Polling interval in milliseconds (default: 60s)
 */
function startLifecycleService(intervalMs = 60000) {
  // Execute immediately on startup
  processExpiredBookings().catch(err => {
    console.error('[Lifecycle] Startup sweep error:', err.message);
  });

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(() => {
    processExpiredBookings().catch(err => {
      console.error('[Lifecycle] Periodic sweep error:', err.message);
    });
  }, intervalMs);

  if (intervalId && intervalId.unref) {
    intervalId.unref();
  }

  console.log(`[Lifecycle] Background booking lifecycle service active (interval: ${intervalMs / 1000}s)`);
}

/**
 * Cleanly stops the background lifecycle monitor during server shutdown.
 */
function stopLifecycleService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Lifecycle] Background booking lifecycle service stopped.');
  }
}

module.exports = {
  processExpiredBookings,
  startLifecycleService,
  stopLifecycleService
};
