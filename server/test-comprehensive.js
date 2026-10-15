// Comprehensive Integration & Security Audit Test for Smart Parking Finder
const http = require('http');

async function makeRequest(path, method = 'GET', body = null, token = null) {
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

async function runComprehensiveAudit() {
  console.log('===========================================================');
  console.log('🚗 SMART PARKING FINDER — FULL FUNCTIONAL AUDIT SUITE');
  console.log('===========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
    }
  }

  // 1. Health and Database Engine
  console.log('--- 1. Backend Service & Active Database ---');
  const health = await makeRequest('/api/health');
  assert(health.status === 200 && health.data.status === 'healthy', 'Health endpoint reports 200 Healthy');
  assert(health.data.databaseEngine === 'SQLITE' || health.data.databaseEngine === 'MYSQL', `Active database engine identified: ${health.data.databaseEngine}`);

  // 2. Authentication & Validation Errors
  console.log('\n--- 2. User Authentication & Input Validation ---');
  const invalidLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'user@parkingfinder.com',
    password: 'WrongPassword123'
  });
  assert(invalidLogin.status === 401, 'Invalid password correctly rejected with 401 Unauthorized');

  const randomEmail = `driver_${Date.now()}@testparking.com`;
  const registerRes = await makeRequest('/api/auth/register', 'POST', {
    full_name: 'Test Audit Driver',
    email: randomEmail,
    password: 'Password@123',
    phone: '+1 555-0199'
  });
  assert(registerRes.status === 201, `User registration succeeded (201 Created) for ${randomEmail}`);
  const newDriverToken = registerRes.data?.token;

  const duplicateRegister = await makeRequest('/api/auth/register', 'POST', {
    full_name: 'Duplicate Test',
    email: randomEmail,
    password: 'Password@123'
  });
  assert(duplicateRegister.status === 409, 'Duplicate user registration rejected with 409 Conflict');

  // Existing test accounts
  const userLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'user@parkingfinder.com',
    password: 'User@123'
  });
  assert(userLogin.status === 200 && userLogin.data?.token, 'Default user login successful (200 OK)');
  const userToken = userLogin.data.token;

  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@parkingfinder.com',
    password: 'Admin@123'
  });
  assert(adminLogin.status === 200 && adminLogin.data?.user?.role === 'admin', 'Default admin login successful (200 OK, role: admin)');
  const adminToken = adminLogin.data.token;

  // 3. Security & Access Control (RBAC)
  console.log('\n--- 3. Role-Based Access Control (RBAC) Verification ---');
  const unauthAdmin = await makeRequest('/api/admin/dashboard-stats', 'GET');
  assert(unauthAdmin.status === 401, 'Unauthenticated request to admin dashboard blocked (401 Unauthorized)');

  const userAttemptAdmin = await makeRequest('/api/admin/dashboard-stats', 'GET', null, userToken);
  assert(userAttemptAdmin.status === 403, 'Regular user token rejected from admin stats (403 Forbidden)');

  const userAttemptCreateLocation = await makeRequest('/api/locations', 'POST', {
    name: 'Unauthorized Lot'
  }, userToken);
  assert(userAttemptCreateLocation.status === 403, 'Regular user token cannot create parking locations (403 Forbidden)');

  const adminStats = await makeRequest('/api/admin/dashboard-stats', 'GET', null, adminToken);
  assert(adminStats.status === 200 && adminStats.data?.success, 'Admin token successfully accesses dashboard statistics (200 OK)');

  // 4. Parking Search & Dynamic Filtering
  console.log('\n--- 4. Parking Search & Filter System ---');
  const allLocations = await makeRequest('/api/locations');
  assert(allLocations.status === 200 && allLocations.data.data.length > 0, `Fetched ${allLocations.data.data.length} active parking locations`);

  const searchKeyword = await makeRequest('/api/locations?search=Downtown');
  assert(searchKeyword.status === 200 && searchKeyword.data.data.every(l => l.name.includes('Downtown') || l.address.includes('Downtown')), 'Search query "?search=Downtown" matches location attributes');

  const priceFilter = await makeRequest('/api/locations?maxPrice=3.50');
  assert(priceFilter.status === 200 && priceFilter.data.data.every(l => Number(l.hourly_rate) <= 3.50), 'Price filter "?maxPrice=3.50" accurately bounds hourly rate');

  // 5. Facility Slots & Dynamic Conflict Checking
  console.log('\n--- 5. Slot Details & Window Conflicts ---');
  const locId = allLocations.data.data[0].id;
  const slotsRes = await makeRequest(`/api/locations/${locId}/slots`);
  assert(slotsRes.status === 200 && slotsRes.data.data.length > 0, `Location #${locId} has ${slotsRes.data.data.length} configured parking slots`);

  // 6. Reservation, QR Ticket & Concurrency Guard
  console.log('\n--- 6. Reservation Lifecycle, QR Generation & Concurrency ---');
  const availableSlot = slotsRes.data.data.find(s => s.status === 'available');
  assert(availableSlot !== undefined, `Found available slot #${availableSlot?.id} (${availableSlot?.slot_number}) for booking test`);

  const bookStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const bookEndTime = new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString();

  // Test concurrency guard
  const [attemptA, attemptB] = await Promise.all([
    makeRequest('/api/bookings', 'POST', {
      location_id: locId,
      slot_id: availableSlot.id,
      start_time: bookStartTime,
      end_time: bookEndTime,
      vehicle_number: 'AUDIT-A1'
    }, userToken),
    makeRequest('/api/bookings', 'POST', {
      location_id: locId,
      slot_id: availableSlot.id,
      start_time: bookStartTime,
      end_time: bookEndTime,
      vehicle_number: 'AUDIT-B2'
    }, userToken)
  ]);

  const outcomes = [attemptA.status, attemptB.status].sort();
  assert(outcomes[0] === 201 && outcomes[1] === 409, 'ACID Concurrency: Exactly one booking succeeded (201) and duplicate overlapping request rejected (409 Conflict)');

  const createdBooking = attemptA.status === 201 ? attemptA.data.data : attemptB.data.data;
  assert(createdBooking.bookingCode && createdBooking.bookingCode.startsWith('SPF-'), `Genuine booking ticket code generated: ${createdBooking.bookingCode}`);
  assert(createdBooking.qrCodeDataUrl && createdBooking.qrCodeDataUrl.startsWith('data:image/png;base64,'), 'QR code properly encoded as Base64 PNG data URI');

  // Verify user's booking list
  const myBookings = await makeRequest('/api/bookings/my', 'GET', null, userToken);
  assert(myBookings.status === 200 && myBookings.data.data.some(b => b.id === createdBooking.bookingId), 'Created booking persisted and retrieved in "My Bookings" list');

  // 7. Gate Operator Check-in & Check-out Workflow
  console.log('\n--- 7. Gate Operator Verification (Check-In & Check-Out) ---');
  const checkInRes = await makeRequest(`/api/admin/bookings/${createdBooking.bookingId}/check-in`, 'PATCH', {}, adminToken);
  assert(checkInRes.status === 200, 'Gate operator check-in succeeded: vehicle admitted');

  const checkOutRes = await makeRequest(`/api/admin/bookings/${createdBooking.bookingId}/check-out`, 'PATCH', {}, adminToken);
  assert(checkOutRes.status === 200, 'Gate operator check-out succeeded: vehicle departed and booking completed');

  // 8. Cancellation & Instant Availability Release on New Booking
  console.log('\n--- 8. Slot Release via User Cancellation ---');
  const cancelSlotTimeStart = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const cancelSlotTimeEnd = new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString();

  const tempBooking = await makeRequest('/api/bookings', 'POST', {
    location_id: locId,
    slot_id: availableSlot.id,
    start_time: cancelSlotTimeStart,
    end_time: cancelSlotTimeEnd,
    vehicle_number: 'RELEASE-01'
  }, userToken);

  assert(tempBooking.status === 201, 'Created second test booking for cancellation test');
  const tempBookingId = tempBooking.data.data.bookingId;

  // Window query before cancel
  const queryWindow = `/api/locations/${locId}/slots?startTime=${encodeURIComponent(cancelSlotTimeStart)}&endTime=${encodeURIComponent(cancelSlotTimeEnd)}`;
  const slotsBeforeCancel = await makeRequest(queryWindow);
  const slotBefore = slotsBeforeCancel.data.data.find(s => s.id === availableSlot.id);
  assert(slotBefore.isAvailable === false, 'Slot confirmed unavailable in booking time window');

  // Perform cancellation
  const cancelAction = await makeRequest(`/api/bookings/${tempBookingId}/cancel`, 'PATCH', {}, userToken);
  assert(cancelAction.status === 200, 'User cancellation request completed (200 OK)');

  // Window query after cancel
  const slotsAfterCancel = await makeRequest(queryWindow);
  const slotAfter = slotsAfterCancel.data.data.find(s => s.id === availableSlot.id);
  assert(slotAfter.isAvailable === true, 'Slot instantly restored to Available status upon cancellation');

  // 9. Admin Reports & Overrides Audit Trail
  console.log('\n--- 9. Admin Utilization Reports & Audit Logs ---');
  const reportsRes = await makeRequest('/api/admin/reports', 'GET', null, adminToken);
  assert(reportsRes.status === 200 && reportsRes.data.data.locations, 'Admin reports return facility occupancy breakdowns and revenue summaries');

  console.log('\n===========================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('===========================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
