// Comprehensive Automated Test Suite for Phase 2: Booking Automation & Map Navigation
const http = require('http');
const db = require('./config/db');
const { processExpiredBookings } = require('./services/lifecycle.service');

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

// Client-side navigation link generation logic for testing
function getNavigationLinks(location) {
  if (!location) return null;

  const rawLat = location.latitude ?? location.lat;
  const rawLng = location.longitude ?? location.lng;

  const lat = rawLat !== undefined && rawLat !== null && !isNaN(Number(rawLat))
    ? Number(rawLat)
    : null;
  const lng = rawLng !== undefined && rawLng !== null && !isNaN(Number(rawLng))
    ? Number(rawLng)
    : null;

  const hasCoordinates = lat !== null && lng !== null && (lat !== 0 || lng !== 0);

  const addressParts = [
    location.location_name || location.name,
    location.location_address || location.address,
    location.city
  ].filter(Boolean);

  const destinationAddress = addressParts.join(', ').trim();

  if (!hasCoordinates && !destinationAddress) {
    return null;
  }

  let googleMapsUrl = '';
  let appleMapsUrl = '';
  let wazeUrl = '';

  if (hasCoordinates) {
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    wazeUrl = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  } else {
    const encodedDest = encodeURIComponent(destinationAddress);
    googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}`;
    appleMapsUrl = `https://maps.apple.com/?daddr=${encodedDest}&dirflg=d`;
    wazeUrl = `https://www.waze.com/ul?q=${encodedDest}&navigate=yes`;
  }

  return {
    hasCoordinates,
    latitude: lat,
    longitude: lng,
    destinationDisplay: destinationAddress,
    googleMapsUrl,
    appleMapsUrl,
    wazeUrl
  };
}

async function runPhase2Tests() {
  console.log('===========================================================');
  console.log('🚀 SMART PARKING FINDER — PHASE 2 AUTOMATION & MAP TEST SUITE');
  console.log('===========================================================\n');

  await db.initDb();

  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
    }
  }

  // Log in as standard user
  const userLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'user@parkingfinder.com',
    password: 'User@123'
  });
  const userToken = userLogin.data.token;
  const userId = userLogin.data.user.id;

  // Log in as admin
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@parkingfinder.com',
    password: 'Admin@123'
  });
  const adminToken = adminLogin.data.token;

  // 1. Time Validation Tests
  console.log('--- 1. Reservation Time & Duration Validation ---');

  // Test past start time rejection
  const pastStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  const pastEndTime = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
  const pastBookingRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 1,
    start_time: pastStartTime,
    end_time: pastEndTime
  }, userToken);
  assert(pastBookingRes.status === 400 && pastBookingRes.data.message.includes('past'), 'Past reservation start time rejected with 400 (cannot book in past)');

  // Test end time before or equal to start time
  const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const invalidEnd = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const invertedTimeRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 1,
    start_time: futureStart,
    end_time: invalidEnd
  }, userToken);
  assert(invertedTimeRes.status === 400 && invertedTimeRes.data.message.includes('after start time'), 'End time before start time rejected with 400');

  // Test minimum duration (< 30 minutes)
  const tooShortEnd = new Date(new Date(futureStart).getTime() + 15 * 60 * 1000).toISOString(); // 15 mins
  const shortDurationRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 1,
    start_time: futureStart,
    end_time: tooShortEnd
  }, userToken);
  assert(shortDurationRes.status === 400 && shortDurationRes.data.message.includes('Minimum booking duration'), 'Duration under 30 minutes rejected with 400');

  // Test maximum duration (> 72 hours)
  const tooLongEnd = new Date(new Date(futureStart).getTime() + 80 * 60 * 60 * 1000).toISOString(); // 80 hrs
  const longDurationRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 1,
    start_time: futureStart,
    end_time: tooLongEnd
  }, userToken);
  assert(longDurationRes.status === 400 && longDurationRes.data.message.includes('Maximum single booking duration'), 'Duration over 72 hours rejected with 400');

  // Test malformed date strings
  const malformedRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 1,
    start_time: 'not-a-valid-date',
    end_time: 'also-invalid'
  }, userToken);
  assert(malformedRes.status === 400 && malformedRes.data.message.includes('Invalid date/time format'), 'Malformed date/time strings rejected with 400');

  // 2. Booking Lifecycle Automation Tests
  console.log('\n--- 2. Automated Booking Lifecycle Service ---');

  // Create a genuine future booking
  const validStart = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(); // +30h
  const validEnd = new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString();   // +32h
  const futureBookingRes = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 2,
    start_time: validStart,
    end_time: validEnd,
    vehicle_number: 'FUTR-001'
  }, userToken);
  assert(futureBookingRes.status === 201, 'Future reservation created successfully');
  const futureBookingId = futureBookingRes.data.data.bookingId;

  // Insert a test booking directly whose end_time is in the past (e.g., ended 10 mins ago)
  const pastTestCode = `SPF-EXP-${Date.now().toString().slice(-6)}`;
  const pastStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // ended 10 mins ago
  const [insertExpired] = await db.execute(
    `INSERT INTO bookings 
     (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, vehicle_number, qr_code_data, check_in_time)
     VALUES (?, ?, 1, 2, ?, ?, 8.00, 'confirmed', 'EXP-999', 'qr-placeholder', ?)`,
    [pastTestCode, userId, pastStart, pastEnd, pastStart]
  );
  const expiredBookingId = insertExpired.insertId;
  console.log(`   Seeded test expired booking #${expiredBookingId} (${pastTestCode})`);

  // Insert a cancelled booking in the past
  const cancelledTestCode = `SPF-CNC-${Date.now().toString().slice(-6)}`;
  const [insertCancelled] = await db.execute(
    `INSERT INTO bookings 
     (booking_code, user_id, location_id, slot_id, start_time, end_time, total_amount, booking_status, vehicle_number, qr_code_data)
     VALUES (?, ?, 1, 3, ?, ?, 8.00, 'cancelled', 'CNC-999', 'qr-placeholder')`,
    [cancelledTestCode, userId, pastStart, pastEnd]
  );
  const cancelledBookingId = insertCancelled.insertId;

  // Run lifecycle sweep
  const sweepResult = await processExpiredBookings();
  assert(sweepResult.updatedIds.includes(expiredBookingId), `Expired booking #${expiredBookingId} processed and auto-completed by lifecycle service`);

  // Verify expired booking is now 'completed' with check_out_time filled
  const [expiredRow] = await db.execute('SELECT * FROM bookings WHERE id = ?', [expiredBookingId]);
  assert(expiredRow[0].booking_status === 'completed', 'Expired booking status transitioned from confirmed to completed');
  assert(expiredRow[0].check_out_time !== null, 'Expired booking check_out_time populated automatically upon lifecycle completion');

  // Verify future booking remains 'confirmed' (NEVER completed prematurely)
  const [futureRow] = await db.execute('SELECT * FROM bookings WHERE id = ?', [futureBookingId]);
  assert(futureRow[0].booking_status === 'confirmed', 'Future booking remains strictly confirmed (not completed prematurely)');

  // Verify cancelled booking remains 'cancelled' (NEVER resurrected)
  const [cancelledRow] = await db.execute('SELECT * FROM bookings WHERE id = ?', [cancelledBookingId]);
  assert(cancelledRow[0].booking_status === 'cancelled', 'Cancelled booking remains cancelled');

  // Test idempotency / repeated sweep
  const secondSweep = await processExpiredBookings();
  assert(secondSweep.processed === 0 && secondSweep.updatedIds.length === 0, 'Repeated lifecycle execution does not cause duplicate updates (idempotent)');

  // Test admin manual sweep trigger endpoint
  const adminSweepRes = await makeRequest('/api/admin/lifecycle-sweep', 'POST', {}, adminToken);
  assert(adminSweepRes.status === 200 && adminSweepRes.data.success, 'POST /api/admin/lifecycle-sweep allows manual on-demand execution');

  // 3. Availability and Conflict Integrity
  console.log('\n--- 3. Availability & Slot Conflict Integrity ---');

  // Future overlapping reservation remains blocked
  const overlapCheckUrl = `/api/locations/1/slots?startTime=${encodeURIComponent(validStart)}&endTime=${encodeURIComponent(validEnd)}`;
  const checkFutureOverlap = await makeRequest(overlapCheckUrl);
  const targetFutureSlot = checkFutureOverlap.data.data.find(s => s.id === 2);
  assert(targetFutureSlot.isAvailable === false && targetFutureSlot.effectiveStatus === 'reserved', 'Future confirmed reservation blocks its overlapping window');

  // Expired completed booking does NOT block availability
  const checkExpiredWindow = await makeRequest(`/api/locations/1/slots?startTime=${encodeURIComponent(pastStart)}&endTime=${encodeURIComponent(pastEnd)}`);
  const slotInExpiredWindow = checkExpiredWindow.data.data.find(s => s.id === 2);
  assert(slotInExpiredWindow.isAvailable === true, 'Expired completed booking does not block availability');

  // Maintenance restriction remains effective
  await db.execute("UPDATE parking_slots SET status = 'maintenance' WHERE id = 4");
  const checkMaintSlot = await makeRequest(`/api/locations/1/slots?startTime=${encodeURIComponent(validStart)}&endTime=${encodeURIComponent(validEnd)}`);
  const maintSlot = checkMaintSlot.data.data.find(s => s.id === 4);
  assert(maintSlot.isAvailable === false && maintSlot.effectiveStatus === 'maintenance', 'Administrator maintenance override remains strictly effective');
  // Revert maintenance slot
  await db.execute("UPDATE parking_slots SET status = 'available' WHERE id = 4");

  // Cancellation preserves other overlapping reservations
  const cancelTestStart = new Date(Date.now() + 40 * 60 * 60 * 1000).toISOString();
  const cancelTestEnd = new Date(Date.now() + 42 * 60 * 60 * 1000).toISOString();
  const bookingToCancel = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 3,
    start_time: cancelTestStart,
    end_time: cancelTestEnd,
    vehicle_number: 'CANCEL-TEST'
  }, userToken);
  const cancelBookingId = bookingToCancel.data.data.bookingId;

  await makeRequest(`/api/bookings/${cancelBookingId}/cancel`, 'PATCH', {}, userToken);
  const [cancelledBookingDb] = await db.execute('SELECT booking_status FROM bookings WHERE id = ?', [cancelBookingId]);
  assert(cancelledBookingDb[0].booking_status === 'cancelled', 'User cancellation successfully sets booking_status to cancelled');

  // Clean up future booking created for test
  await makeRequest(`/api/bookings/${futureBookingId}/cancel`, 'PATCH', {}, userToken);

  // 4. Map Navigation Link Generation Tests
  console.log('\n--- 4. Map Deep-Link Generation (Google, Apple, Waze) ---');

  // Case A: With valid coordinates
  const facilityWithCoords = {
    location_name: 'Metro Center Garage',
    location_address: '100 Broadway',
    city: 'Metropolis',
    latitude: 40.7128,
    longitude: -74.0060
  };
  const navA = getNavigationLinks(facilityWithCoords);
  assert(navA.hasCoordinates === true, 'Navigation recognizes valid geographic coordinates');
  assert(navA.googleMapsUrl === 'https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006', 'Google Maps link includes exact GPS destination coordinates');
  assert(navA.appleMapsUrl === 'https://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d', 'Apple Maps link formats daddr parameter with driving directions');
  assert(navA.wazeUrl === 'https://www.waze.com/ul?ll=40.7128,-74.006&navigate=yes', 'Waze link formats latitude,longitude with direct navigation trigger');

  // Case B: Missing coordinates (Address fallback)
  const facilityWithoutCoords = {
    location_name: 'Uptown Deck',
    location_address: '450 Park Avenue',
    city: 'New York',
    latitude: null,
    longitude: null
  };
  const navB = getNavigationLinks(facilityWithoutCoords);
  assert(navB.hasCoordinates === false, 'Navigation recognizes missing coordinates');
  const expectedEncoded = encodeURIComponent('Uptown Deck, 450 Park Avenue, New York');
  assert(navB.googleMapsUrl.includes(expectedEncoded), 'Google Maps falls back to URL-encoded facility name and address');
  assert(navB.appleMapsUrl.includes(expectedEncoded), 'Apple Maps falls back to URL-encoded facility name and address');
  assert(navB.wazeUrl.includes(expectedEncoded), 'Waze falls back to URL-encoded address query');

  // Case C: Null / Unusable location (Safe return null)
  const invalidLoc = { latitude: null, longitude: null, location_name: '', location_address: '', city: '' };
  const navC = getNavigationLinks(invalidLoc);
  assert(navC === null, 'Navigation safely returns null when no usable destination exists (prevents broken links)');

  // 5. Check-In & Check-Out Workflow
  console.log('\n--- 5. Gate Check-In & Check-Out Verification ---');
  const gateTestStart = new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString();
  const gateTestEnd = new Date(Date.now() + 52 * 60 * 60 * 1000).toISOString();
  const gateBooking = await makeRequest('/api/bookings', 'POST', {
    location_id: 1,
    slot_id: 5,
    start_time: gateTestStart,
    end_time: gateTestEnd,
    vehicle_number: 'GATE-001'
  }, userToken);
  const gateBookingId = gateBooking.data.data.bookingId;

  // Check In
  const checkInRes = await makeRequest(`/api/admin/bookings/${gateBookingId}/check-in`, 'PATCH', {}, adminToken);
  assert(checkInRes.status === 200, 'Gate operator check-in successful');
  const [checkedInRow] = await db.execute('SELECT check_in_time, check_out_time, booking_status FROM bookings WHERE id = ?', [gateBookingId]);
  assert(checkedInRow[0].check_in_time !== null && checkedInRow[0].booking_status === 'confirmed', 'Check-in time recorded while booking remains confirmed');

  // Check Out
  const checkOutRes = await makeRequest(`/api/admin/bookings/${gateBookingId}/check-out`, 'PATCH', {}, adminToken);
  assert(checkOutRes.status === 200, 'Gate operator check-out successful');
  const [checkedOutRow] = await db.execute('SELECT check_in_time, check_out_time, booking_status FROM bookings WHERE id = ?', [gateBookingId]);
  assert(checkedOutRow[0].check_out_time !== null && checkedOutRow[0].booking_status === 'completed', 'Check-out time recorded and booking status marked completed');

  // 6. Test Data Cleanup
  console.log('\n--- 6. Clean Up Temporary Test Records ---');
  await db.execute(
    "DELETE FROM bookings WHERE booking_code LIKE 'SPF-EXP-%' OR booking_code LIKE 'SPF-CNC-%' OR id IN (?, ?, ?)",
    [futureBookingId, cancelBookingId, gateBookingId]
  );
  console.log('   Test records safely cleaned up.');

  console.log('\n===========================================================');
  console.log(`PHASE 2 TEST SUMMARY: ${passed} / ${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('===========================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Phase 2 test error:', err);
    process.exit(1);
  });
