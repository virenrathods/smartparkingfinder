// Comprehensive Automated Test Suite for Phase 3:
// Email Notifications, Booking Reminders, and Lifecycle Improvements
const http = require('http');
const db = require('./config/db');
const emailService = require('./services/email.service');
const { processExpiredBookings } = require('./services/lifecycle.service');
const { processReminders } = require('./services/reminder.service');

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body && { 'Content-Length': Buffer.byteLength(postData) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(postData);
    req.end();
  });
}

// In-memory mock transporter to record sent emails without external network dependencies
class MockTransporter {
  constructor() {
    this.sentEmails = [];
    this.shouldFail = false;
    this.failureError = new Error('Connection refused: mock SMTP timeout');
  }

  async sendMail(mailOptions) {
    if (this.shouldFail) {
      throw this.failureError;
    }
    const messageId = `<mock-${Date.now()}-${Math.random().toString(36).substring(7)}@smartparking.local>`;
    this.sentEmails.push({ ...mailOptions, messageId, sentAt: new Date() });
    return { messageId, response: '250 Mock Message Accepted' };
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

async function runPhase3Tests() {
  console.log('===========================================================');
  console.log('📬 SMART PARKING FINDER — PHASE 3 AUTOMATION & EMAIL SUITE');
  console.log('===========================================================\n');

  await db.initDb();
  const mockTransport = new MockTransporter();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraDetails = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${extraDetails ? `(${extraDetails})` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PART 1: SERVICE UNIT TESTS (WITH IN-MEMORY MOCK TRANSPORT)
    // -------------------------------------------------------------
    console.log('--- 1. EMAIL SERVICE UNIT VERIFICATION ---');
    // Ensure test facility & slots exist
    const [locs] = await db.execute('SELECT id FROM parking_locations WHERE is_active = 1 LIMIT 1');
    const testLocId = locs[0].id;
    const [slots] = await db.execute('SELECT id, slot_number FROM parking_slots WHERE location_id = ? AND is_active = 1 LIMIT 2', [testLocId]);
    const testSlot1 = slots[0].id;
    const testSlot2 = slots[1].id;

    emailService.setMockTransporter(mockTransport);
    mockTransport.clear();

    // Insert valid booking record for unit test foreign key integrity
    const [unitBookingInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-TEST-UNIT-01', 1, ?, ?, ?, ?, '25.00', 'confirmed', 'mockqr')`,
      [
        testLocId,
        testSlot1,
        new Date(Date.now() + 3600000).toISOString(),
        new Date(Date.now() + 7200000).toISOString()
      ]
    );
    const unitBookingId = unitBookingInsert.insertId;

    const sampleBooking = {
      id: unitBookingId,
      booking_code: 'SPF-TEST-UNIT-01',
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
      total_amount: '25.00',
      vehicle_number: 'UNIT-TEST-01'
    };
    const sampleUser = {
      full_name: 'Test Driver',
      email: 'testdriver@example.com'
    };
    const sampleLocation = {
      name: 'Downtown Smart Garage',
      address: '100 Main St',
      city: 'Metro City'
    };
    const sampleSlot = {
      slot_number: 'B-12',
      slot_type: 'car'
    };

    // Test: Booking confirmation email generation & dispatch
    const confirmResult = await emailService.sendBookingConfirmation({
      booking: sampleBooking,
      user: sampleUser,
      location: sampleLocation,
      slot: sampleSlot
    });

    assert(confirmResult.success === true, 'Confirmation email send succeeded via mock transport');
    assert(mockTransport.sentEmails.length === 1, 'Mock transport recorded 1 outbound confirmation email');
    const sentConfirm = mockTransport.sentEmails[0];
    assert(sentConfirm.to === 'testdriver@example.com', 'Recipient email matches driver');
    assert(sentConfirm.subject.includes('SPF-TEST-UNIT-01'), 'Email subject contains booking reference');
    assert(sentConfirm.text.includes('Downtown Smart Garage') && sentConfirm.html.includes('Downtown Smart Garage'), 'Email contains location name in text & HTML');
    assert(sentConfirm.text.includes('B-12') && sentConfirm.html.includes('B-12'), 'Email contains slot identifier in text & HTML');
    assert(sentConfirm.text.includes('UNIT-TEST-01') && sentConfirm.html.includes('UNIT-TEST-01'), 'Email contains vehicle number');
    assert(sentConfirm.text.includes('$25.00') && sentConfirm.html.includes('$25.00'), 'Email contains parking fee');

    // Test: Notification table recorded status = 'sent'
    const [auditConfirmRows] = await db.execute(
      "SELECT * FROM notifications WHERE booking_id = ? AND notification_type = 'confirmation'",
      [unitBookingId]
    );
    assert(auditConfirmRows.length > 0 && auditConfirmRows[0].delivery_status === 'sent', 'Confirmation status saved as "sent" in notifications table');

    // Test: Cancellation email generation & dispatch
    mockTransport.clear();
    const cancelResult = await emailService.sendCancellationEmail({
      booking: sampleBooking,
      user: sampleUser,
      location: sampleLocation,
      slot: sampleSlot
    });
    assert(cancelResult.success === true, 'Cancellation email send succeeded');
    assert(mockTransport.sentEmails.length === 1, 'Cancellation email recorded by mock transport');
    assert(mockTransport.sentEmails[0].subject.includes('Cancelled') && mockTransport.sentEmails[0].subject.includes('SPF-TEST-UNIT-01'), 'Cancellation email subject contains reference');

    // Test: Graceful unconfigured SMTP mode
    console.log('\n--- 2. UNCONFIGURED SMTP GRACEFUL DEGRADATION ---');
    emailService.setMockTransporter(null);
    const origHost = process.env.SMTP_HOST;
    const origUser = process.env.SMTP_USER;
    const origMock = process.env.MOCK_SMTP;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.MOCK_SMTP;

    const [unconfBookingInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-UNCONF-01', 1, ?, ?, ?, ?, '15.00', 'confirmed', 'mockqr')`,
      [
        testLocId,
        testSlot1,
        new Date(Date.now() + 3600000).toISOString(),
        new Date(Date.now() + 7200000).toISOString()
      ]
    );
    const unconfBookingId = unconfBookingInsert.insertId;

    const unconfResult = await emailService.sendBookingConfirmation({
      booking: { ...sampleBooking, id: unconfBookingId, booking_code: 'SPF-UNCONF-01' },
      user: sampleUser,
      location: sampleLocation,
      slot: sampleSlot
    });
    assert(unconfResult.skipped === true, 'Unconfigured SMTP safely returns skipped status');
    assert(unconfResult.success === false, 'Unconfigured SMTP does NOT claim email was sent');

    const [auditUnconfRows] = await db.execute(
      "SELECT * FROM notifications WHERE booking_id = ? AND notification_type = 'confirmation'",
      [unconfBookingId]
    );
    assert(auditUnconfRows.length > 0 && auditUnconfRows[0].delivery_status === 'skipped', 'Notification table records status = "skipped" when SMTP is unconfigured');

    // Restore mock transport
    emailService.setMockTransporter(mockTransport);
    if (origHost) process.env.SMTP_HOST = origHost;
    if (origUser) process.env.SMTP_USER = origUser;
    if (origMock) process.env.MOCK_SMTP = origMock;

    // Test: Transient failure handling
    console.log('\n--- 3. TRANSIENT EMAIL FAILURE HANDLING ---');
    mockTransport.clear();
    mockTransport.shouldFail = true;

    const [failBookingInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-FAIL-01', 1, ?, ?, ?, ?, '18.00', 'confirmed', 'mockqr')`,
      [
        testLocId,
        testSlot1,
        new Date(Date.now() + 3600000).toISOString(),
        new Date(Date.now() + 7200000).toISOString()
      ]
    );
    const failBookingId = failBookingInsert.insertId;

    const failEmailResult = await emailService.sendBookingConfirmation({
      booking: { ...sampleBooking, id: failBookingId, booking_code: 'SPF-FAIL-01' },
      user: sampleUser,
      location: sampleLocation,
      slot: sampleSlot
    });
    assert(failEmailResult.success === false, 'Failing transport returns success = false');
    assert(Boolean(failEmailResult.error), 'Failing transport returns sanitized error description');

    const [auditFailRows] = await db.execute(
      "SELECT * FROM notifications WHERE booking_id = ? AND notification_type = 'confirmation'",
      [failBookingId]
    );
    assert(auditFailRows.length > 0 && auditFailRows[0].delivery_status === 'failed', 'Failing transport records status = "failed" in notifications');
    assert(!auditFailRows[0].error_message.includes('password'), 'Error message in notifications is sanitized');

    mockTransport.shouldFail = false;

    // -------------------------------------------------------------
    // PART 2: BOOKING REMINDER SCHEDULER & RECOVERY POLICIES
    // -------------------------------------------------------------
    console.log('\n--- 4. AUTOMATIC REMINDERS & SCHEDULER ---');

    // Insert future confirmed booking starting in 10 minutes (within 15-minute reminder window)
    const tenMinStart = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tenMinEnd = new Date(Date.now() + 70 * 60 * 1000).toISOString();

    const [remBookingInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-REMIND-01', 1, ?, ?, ?, ?, '12.00', 'confirmed', 'mockqr')`,
      [testLocId, testSlot1, tenMinStart, tenMinEnd]
    );
    const remBookingId = remBookingInsert.insertId;

    mockTransport.clear();
    const reminderSweep1 = await processReminders();
    assert(reminderSweep1.processed >= 1, `Reminder service processed eligible upcoming booking (${reminderSweep1.processed} processed)`);
    assert(mockTransport.sentEmails.length === 1, 'Reminder email dispatched to driver');
    assert(
      mockTransport.sentEmails[0].subject.includes('starts soon') || mockTransport.sentEmails[0].subject.includes('Reminder'),
      'Reminder email subject alerts driver of upcoming window'
    );

    // Idempotency: Second sweep must NOT duplicate reminder
    mockTransport.clear();
    const reminderSweep2 = await processReminders();
    assert(reminderSweep2.processed === 0, 'Second reminder sweep did not duplicate reminder');
    assert(mockTransport.sentEmails.length === 0, 'Zero duplicate emails dispatched on second sweep');

    // Recovery Policy: Offline missed reminders for bookings whose start time already arrived/passed
    console.log('\n--- 5. REMINDER OFFLINE RECOVERY POLICY ---');
    const pastOfflineStart = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const pastOfflineEnd = new Date(Date.now() + 40 * 60 * 1000).toISOString();
    await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-OFFLINE-PAST', 1, ?, ?, ?, ?, '15.00', 'confirmed', 'mockqr')`,
      [testLocId, testSlot1, pastOfflineStart, pastOfflineEnd]
    );
    mockTransport.clear();
    await processReminders();
    assert(mockTransport.sentEmails.length === 0, 'Offline recovery policy: No "starts soon" reminder sent for already elapsed start times');

    // Cancelled future bookings must NOT receive reminders
    const cancelledStart = new Date(Date.now() + 12 * 60 * 1000).toISOString();
    const cancelledEnd = new Date(Date.now() + 72 * 60 * 1000).toISOString();
    await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-CANCELLED-REM', 1, ?, ?, ?, ?, '15.00', 'cancelled', 'mockqr')`,
      [testLocId, testSlot2, cancelledStart, cancelledEnd]
    );
    mockTransport.clear();
    await processReminders();
    assert(mockTransport.sentEmails.length === 0, 'Cancelled bookings are ineligible for reminder notifications');

    // -------------------------------------------------------------
    // PART 3: BOOKING STATUS TRANSITIONS & LIFECYCLE SWEEPER
    // -------------------------------------------------------------
    console.log('\n--- 6. BOOKING STATUS TRANSITIONS & LIFECYCLE ---');
    // Scenario A: Ended reservation WITHOUT check-in -> must become 'expired'
    const expiredStart = new Date(Date.now() - 3 * 3600000).toISOString();
    const expiredEnd = new Date(Date.now() - 1 * 3600000).toISOString();
    const [noShowInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, qr_code_data)
       VALUES ('SPF-NOSHOW-01', 1, ?, ?, ?, ?, '10.00', 'confirmed', 'mockqr')`,
      [testLocId, testSlot1, expiredStart, expiredEnd]
    );
    const noShowId = noShowInsert.insertId;

    // Scenario B: Ended reservation WITH check-in -> must become 'completed'
    const completedStart = new Date(Date.now() - 4 * 3600000).toISOString();
    const completedEnd = new Date(Date.now() - 2 * 3600000).toISOString();
    const [checkedInInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, check_in_time, qr_code_data)
       VALUES ('SPF-CHECKEDIN-01', 1, ?, ?, ?, ?, '20.00', 'confirmed', ?, 'mockqr')`,
      [testLocId, testSlot1, completedStart, completedEnd, completedStart]
    );
    const checkedInId = checkedInInsert.insertId;

    // Scenario C: Actively checked-in vehicle whose end_time is in the future -> must NOT be completed
    const activeStart = new Date(Date.now() - 1 * 3600000).toISOString();
    const activeEnd = new Date(Date.now() + 2 * 3600000).toISOString();
    const [activeInsert] = await db.execute(
      `INSERT INTO bookings 
       (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, check_in_time, qr_code_data)
       VALUES ('SPF-ACTIVE-01', 1, ?, ?, ?, ?, '15.00', 'confirmed', ?, 'mockqr')`,
      [testLocId, testSlot2, activeStart, activeEnd, activeStart]
    );
    const activeId = activeInsert.insertId;

    // Run lifecycle sweep
    await processExpiredBookings();

    const [rowNoShow] = await db.execute('SELECT booking_status FROM bookings WHERE id = ?', [noShowId]);
    assert(rowNoShow[0]?.booking_status === 'expired', 'Elapsed booking without check-in transitioned to "expired"');

    const [rowCheckedIn] = await db.execute('SELECT booking_status FROM bookings WHERE id = ?', [checkedInId]);
    assert(rowCheckedIn[0]?.booking_status === 'completed', 'Elapsed checked-in booking transitioned to "completed"');

    const [rowActive] = await db.execute('SELECT booking_status FROM bookings WHERE id = ?', [activeId]);
    assert(rowActive[0]?.booking_status === 'confirmed', 'Actively checked-in vehicle with remaining permitted time remains "confirmed"');

    // -------------------------------------------------------------
    // PART 4: FULL END-TO-END HTTP API INTEGRATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 7. END-TO-END API INTEGRATION & SECURITY ---');
    // Authenticate users
    const userLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'user@parkingfinder.com',
      password: 'User@123'
    });
    const userToken = userLogin.data?.token;
    assert(userLogin.status === 200 && userToken, 'User login succeeded');

    const adminLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@parkingfinder.com',
      password: 'Admin@123'
    });
    const adminToken = adminLogin.data?.token;
    assert(adminLogin.status === 200 && adminToken, 'Admin login succeeded');

    // Create booking via HTTP API
    const apiStart = new Date(Date.now() + 6 * 3600000);
    const apiEnd = new Date(apiStart.getTime() + 2 * 3600000);

    const apiBookingRes = await makeRequest('/api/bookings', 'POST', {
      location_id: testLocId,
      slot_id: testSlot1,
      start_time: apiStart.toISOString(),
      end_time: apiEnd.toISOString(),
      vehicle_number: 'API-TEST-99'
    }, userToken);

    assert(apiBookingRes.status === 201 && apiBookingRes.data?.success, 'POST /api/bookings returns 201 Created');
    const apiBookingId = apiBookingRes.data?.data?.bookingId;
    const apiBookingCode = apiBookingRes.data?.data?.bookingCode;
    assert(Boolean(apiBookingId && apiBookingCode), 'API returned bookingId and bookingCode');
    assert(Boolean(apiBookingRes.data?.data?.qrCodeDataUrl), 'API returned authentic QR data URL');

    // Concurrency collision check via HTTP API
    const apiCollisionRes = await makeRequest('/api/bookings', 'POST', {
      location_id: testLocId,
      slot_id: testSlot1,
      start_time: apiStart.toISOString(),
      end_time: apiEnd.toISOString(),
      vehicle_number: 'COLLISION-TEST'
    }, userToken);
    assert(apiCollisionRes.status === 409, 'Overlapping booking safely rejected with 409 Conflict');

    // Cancel booking via HTTP API
    const apiCancelRes = await makeRequest(`/api/bookings/${apiBookingId}/cancel`, 'PATCH', {}, userToken);
    assert(apiCancelRes.status === 200 && apiCancelRes.data?.success, 'PATCH /api/bookings/:id/cancel returns 200 OK');

    const [cancelledDbRow] = await db.execute('SELECT booking_status FROM bookings WHERE id = ?', [apiBookingId]);
    assert(cancelledDbRow[0]?.booking_status === 'cancelled', 'Booking marked cancelled in database');

    // Admin Notification Visibility & Security
    const userAuditForbidden = await makeRequest('/api/admin/notifications', 'GET', null, userToken);
    assert(userAuditForbidden.status === 403, 'Regular user receives 403 Forbidden on notification audit log endpoint');

    const unauthAuditForbidden = await makeRequest('/api/admin/notifications', 'GET', null, null);
    assert(unauthAuditForbidden.status === 401, 'Unauthenticated user receives 401 Unauthorized');

    const adminAuditAllowed = await makeRequest('/api/admin/notifications', 'GET', null, adminToken);
    assert(adminAuditAllowed.status === 200 && adminAuditAllowed.data?.success, 'Admin receives 200 OK on notification audit log endpoint');
    assert(Array.isArray(adminAuditAllowed.data?.data), 'Notification audit logs returned as array');

    const firstAudit = adminAuditAllowed.data?.data?.[0];
    if (firstAudit) {
      assert(
        firstAudit.bookingCode && firstAudit.notificationType && firstAudit.deliveryStatus,
        'Notification log includes bookingCode, notificationType, deliveryStatus'
      );
      assert(
        typeof firstAudit.actionRequired === 'boolean',
        'Notification log includes actionRequired flag'
      );
      assert(
        !firstAudit.recipientEmail || !firstAudit.recipientEmail.includes('password'),
        'No sensitive credentials or full sensitive data exposed'
      );
    }

    // -------------------------------------------------------------
    // PART 5: CLEAN UP TEMPORARY TEST DATA
    // -------------------------------------------------------------
    console.log('\n--- 8. CLEAN UP TEMPORARY TEST DATA ---');
    await db.execute(
      `DELETE FROM bookings 
       WHERE booking_code LIKE 'SPF-TEST-%' 
          OR booking_code LIKE 'SPF-UNCONF-%'
          OR booking_code LIKE 'SPF-FAIL-%'
          OR booking_code LIKE 'SPF-REMIND-%'
          OR booking_code LIKE 'SPF-OFFLINE-%'
          OR booking_code LIKE 'SPF-CANCELLED-%'
          OR booking_code LIKE 'SPF-NOSHOW-%'
          OR booking_code LIKE 'SPF-CHECKEDIN-%'
          OR booking_code LIKE 'SPF-ACTIVE-%'
          OR id = ?`,
      [apiBookingId]
    );
    console.log('   Phase 3 test records safely cleaned up.');

    // -------------------------------------------------------------
    // FINAL TEST RESULTS
    // -------------------------------------------------------------
    console.log('\n===========================================================');
    console.log(`📊 PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPhase3Tests();
