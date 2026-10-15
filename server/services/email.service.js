const nodemailer = require('nodemailer');
const db = require('../config/db');

let mockTransporter = null;

/**
 * Configure or retrieve the active mail transport.
 * Supports custom mock transport during automated testing.
 */
function getTransporter() {
  if (mockTransporter) {
    return mockTransporter;
  }

  if (process.env.MOCK_SMTP === 'true' || process.env.NODE_ENV === 'test') {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: pass || ''
    }
  });
}

function isSmtpConfigured() {
  return Boolean(
    mockTransporter ||
    process.env.MOCK_SMTP === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (process.env.SMTP_HOST && process.env.SMTP_USER)
  );
}

function setMockTransporter(mock) {
  mockTransporter = mock;
}

/**
 * Format ISO datetime string for clean, human-readable display.
 */
function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoString;
  }
}

/**
 * Safely records notification delivery status in the database.
 * Never throws to protect caller transactions.
 */
async function recordNotification({
  bookingId,
  bookingCode,
  recipientEmail,
  notificationType,
  deliveryStatus,
  errorMessage = null
}) {
  try {
    const now = new Date().toISOString();
    // Check if notification record exists for this booking & type
    const [existing] = await db.execute(
      `SELECT id, attempt_count FROM notifications 
       WHERE booking_id = ? AND notification_type = ?`,
      [bookingId, notificationType]
    );

    if (existing && existing.length > 0) {
      const newAttempts = Number(existing[0].attempt_count) + 1;
      await db.execute(
        `UPDATE notifications
         SET delivery_status = ?,
             attempt_count = ?,
             error_message = ?,
             last_attempt_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [deliveryStatus, newAttempts, errorMessage, now, existing[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO notifications
         (booking_id, booking_code, recipient_email, notification_type, delivery_status, attempt_count, error_message, last_attempt_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [bookingId, bookingCode, recipientEmail, notificationType, deliveryStatus, errorMessage, now]
      );
    }
  } catch (err) {
    console.error('[Notification Audit] Failed to record notification status:', err.message);
  }
}

/**
 * Send Booking Confirmation Email
 */
async function sendBookingConfirmation({ booking, user, location, slot }) {
  const recipientEmail = user.email;
  const bookingCode = booking.booking_code || booking.bookingCode;
  const bookingId = booking.id || booking.bookingId;
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

  if (!isSmtpConfigured()) {
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'confirmation',
      deliveryStatus: 'skipped',
      errorMessage: 'SMTP unconfigured in environment'
    });
    return { success: false, skipped: true, message: 'SMTP not configured' };
  }

  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"Smart Parking Finder" <no-reply@parkingfinder.com>';

  const subject = `Reservation Confirmed: ${bookingCode} (${location.name})`;
  const startFormatted = formatDateTime(booking.start_time || booking.startTime);
  const endFormatted = formatDateTime(booking.end_time || booking.endTime);
  const slotNumber = slot.slot_number || slot.slotNumber;
  const slotType = (slot.slot_type || slot.slotType || 'Car').toUpperCase();
  const vehicle = booking.vehicle_number || booking.vehicleNumber || 'Not Stated';
  const amount = Number(booking.total_amount || booking.totalAmount || 0).toFixed(2);

  const textBody = `
SMART PARKING FINDER — RESERVATION CONFIRMED

Hello ${user.full_name || 'Driver'},

Your parking slot has been secured.

Booking Reference: ${bookingCode}
Facility:          ${location.name}
Address:           ${location.address}, ${location.city}
Assigned Bay:      Slot ${slotNumber} (${slotType})
Vehicle Plate:     ${vehicle}
Arrival Time:      ${startFormatted}
Departure Time:    ${endFormatted}
Estimated Fee:     $${amount}

View your genuine digital QR pass:
${appUrl}/my-bookings

Present your QR code pass at the entrance gate for operator admission.
Thank you for choosing Smart Parking Finder!
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #059669, #0284c7); padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; }
    .header p { margin: 6px 0 0 0; color: #e2e8f0; font-size: 13px; }
    .content { padding: 24px; }
    .badge { display: inline-block; background-color: #064e3b; color: #34d399; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .details { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    .details td { padding: 10px 0; border-bottom: 1px solid #1e293b; }
    .details td.label { color: #94a3b8; width: 38%; }
    .details td.value { color: #f8fafc; font-weight: 600; text-align: right; }
    .highlight { color: #34d399; font-family: monospace; font-size: 14px; }
    .action { text-align: center; margin: 28px 0 12px 0; }
    .btn { display: inline-block; background-color: #059669; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; }
    .footer { text-align: center; font-size: 11px; color: #64748b; padding: 16px 24px 24px 24px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Smart Parking Finder</h1>
      <p>Your Parking Slot is Reserved</p>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">Ticket Code: ${bookingCode}</span>
      </div>
      <table class="details">
        <tr>
          <td class="label">Parking Facility</td>
          <td class="value">${location.name}</td>
        </tr>
        <tr>
          <td class="label">Address</td>
          <td class="value">${location.address}, ${location.city}</td>
        </tr>
        <tr>
          <td class="label">Reserved Bay</td>
          <td class="value highlight">${slotNumber} (${slotType})</td>
        </tr>
        <tr>
          <td class="label">Vehicle Plate</td>
          <td class="value">${vehicle}</td>
        </tr>
        <tr>
          <td class="label">Arrival Time</td>
          <td class="value">${startFormatted}</td>
        </tr>
        <tr>
          <td class="label">Departure Time</td>
          <td class="value">${endFormatted}</td>
        </tr>
        <tr>
          <td class="label">Estimated Fee</td>
          <td class="value" style="color: #ffffff; font-size: 15px;">$${amount}</td>
        </tr>
      </table>

      <div class="action">
        <a href="${appUrl}/my-bookings" class="btn">View Digital QR Pass</a>
      </div>
    </div>
    <div class="footer">
      Present your authentic digital pass at the entrance gate for scanner admission.<br>
      Diploma IT Academic Minor Project • Software-Managed Availability
    </div>
  </div>
</body>
</html>
`.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: textBody,
      html: htmlBody
    });

    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'confirmation',
      deliveryStatus: 'sent'
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const sanitizedError = err.message ? err.message.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)/g, '***@***') : 'Unknown email error';
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'confirmation',
      deliveryStatus: 'failed',
      errorMessage: sanitizedError
    });
    return { success: false, error: sanitizedError };
  }
}

/**
 * Send Booking Cancellation Email
 */
async function sendCancellationEmail({ booking, user, location, slot }) {
  const recipientEmail = user.email;
  const bookingCode = booking.booking_code || booking.bookingCode;
  const bookingId = booking.id || booking.bookingId;
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

  if (!isSmtpConfigured()) {
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'cancellation',
      deliveryStatus: 'skipped',
      errorMessage: 'SMTP unconfigured in environment'
    });
    return { success: false, skipped: true, message: 'SMTP not configured' };
  }

  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"Smart Parking Finder" <no-reply@parkingfinder.com>';
  const subject = `Reservation Cancelled: ${bookingCode}`;
  const slotNumber = slot?.slot_number || booking.slot_number || 'N/A';
  const locationName = location?.name || booking.location_name || 'Parking Facility';

  const textBody = `
SMART PARKING FINDER — RESERVATION CANCELLED

Hello ${user.full_name || 'Driver'},

Your parking reservation (${bookingCode}) has been cancelled.
The reserved slot (${slotNumber} at ${locationName}) has been immediately released and made available for other drivers.

No payment has been charged.

Find other parking locations anytime at:
${appUrl}/explore
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; }
    .header { background: #991b1b; padding: 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; }
    .content { padding: 24px; font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .badge { display: inline-block; background-color: #450a0a; color: #f87171; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .action { text-align: center; margin: 24px 0 12px 0; }
    .btn { display: inline-block; background-color: #1e293b; border: 1px solid #334155; color: #f8fafc !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 12px; }
    .footer { text-align: center; font-size: 11px; color: #64748b; padding: 16px 24px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Reservation Cancelled</h1>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">Reference: ${bookingCode}</span>
      </div>
      <p>Hello ${user.full_name || 'Driver'},</p>
      <p>Your reservation at <strong>${locationName}</strong> for slot <strong>${slotNumber}</strong> has been cancelled. The bay has been returned to available status for other drivers.</p>
      <div class="action">
        <a href="${appUrl}/explore" class="btn">Explore Other Parking Lots</a>
      </div>
    </div>
    <div class="footer">
      Smart Parking Finder • Software-Managed Availability
    </div>
  </div>
</body>
</html>
`.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: textBody,
      html: htmlBody
    });

    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'cancellation',
      deliveryStatus: 'sent'
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const sanitizedError = err.message ? err.message.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)/g, '***@***') : 'Unknown email error';
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'cancellation',
      deliveryStatus: 'failed',
      errorMessage: sanitizedError
    });
    return { success: false, error: sanitizedError };
  }
}

/**
 * Send Booking Reminder Email (15 minutes before start)
 */
async function sendBookingReminder({ booking, user, location, slot }) {
  const recipientEmail = user.email;
  const bookingCode = booking.booking_code;
  const bookingId = booking.id;
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

  if (!isSmtpConfigured()) {
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'reminder',
      deliveryStatus: 'skipped',
      errorMessage: 'SMTP unconfigured in environment'
    });
    return { success: false, skipped: true, message: 'SMTP not configured' };
  }

  const transporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"Smart Parking Finder" <no-reply@parkingfinder.com>';
  const subject = `Reminder: Parking starts soon at ${location.name} (${bookingCode})`;
  const startFormatted = formatDateTime(booking.start_time);
  const slotNumber = slot.slot_number;

  const textBody = `
SMART PARKING FINDER — UPCOMING RESERVATION REMINDER

Hello ${user.full_name || 'Driver'},

Your parking reservation begins shortly at ${startFormatted}.

Facility:       ${location.name}
Address:        ${location.address}, ${location.city}
Assigned Bay:   Slot ${slotNumber}
Ticket Code:    ${bookingCode}

View your digital pass and turn-by-turn directions:
${appUrl}/my-bookings
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0284c7, #4f46e5); padding: 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; }
    .content { padding: 24px; font-size: 13px; line-height: 1.6; color: #cbd5e1; }
    .badge { display: inline-block; background-color: #0c4a6e; color: #38bdf8; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .action { text-align: center; margin: 24px 0 12px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; }
    .footer { text-align: center; font-size: 11px; color: #64748b; padding: 16px 24px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Your Parking Window Starts Soon</h1>
    </div>
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">Bay ${slotNumber} • ${bookingCode}</span>
      </div>
      <p>Hello ${user.full_name || 'Driver'},</p>
      <p>This is a quick reminder that your reservation at <strong>${location.name}</strong> begins at <strong>${startFormatted}</strong>.</p>
      <p>Have your digital QR pass ready at the gate for operator check-in.</p>
      <div class="action">
        <a href="${appUrl}/my-bookings" class="btn">Open Pass & Directions</a>
      </div>
    </div>
    <div class="footer">
      Smart Parking Finder • Real-Time Software Availability
    </div>
  </div>
</body>
</html>
`.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject,
      text: textBody,
      html: htmlBody
    });

    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'reminder',
      deliveryStatus: 'sent'
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const sanitizedError = err.message ? err.message.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)/g, '***@***') : 'Unknown email error';
    await recordNotification({
      bookingId,
      bookingCode,
      recipientEmail,
      notificationType: 'reminder',
      deliveryStatus: 'failed',
      errorMessage: sanitizedError
    });
    return { success: false, error: sanitizedError };
  }
}

module.exports = {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendBookingReminder,
  setMockTransporter,
  isSmtpConfigured
};
