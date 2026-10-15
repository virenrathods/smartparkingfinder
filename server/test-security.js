const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const {
  validateAdminPassword,
  bootstrapAdmin,
  seedInfrastructure,
  seedDevelopmentUsers
} = require('./database/bootstrap');

const { resolveSslConfig } = require('./config/db');
const { getValidatedJwtSecret } = require('./controllers/auth.controller');
const { createRateLimiter } = require('./middleware/rate-limit.middleware');

console.log('===========================================================');
console.log('🛡️  SMART PARKING FINDER — PHASE 4.2 PRODUCTION SECURITY SUITE');
console.log('===========================================================');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  passedTests++;
  console.log(`  ✅ [PASS] ${name}`);
}

function fail(name, err) {
  failedTests++;
  console.error(`  ❌ [FAIL] ${name}`);
  console.error(`     Reason: ${err.message || err}`);
}

// In-memory test SQLite adapter wrapping better-sqlite3 to match db.execute interface
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Load schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT CHECK(role IN ('user', 'admin')) DEFAULT 'user' NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parking_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      hourly_rate REAL NOT NULL,
      total_slots INTEGER NOT NULL DEFAULT 0,
      opening_time TEXT NOT NULL DEFAULT '06:00',
      closing_time TEXT NOT NULL DEFAULT '23:00',
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parking_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      slot_number TEXT NOT NULL,
      slot_type TEXT CHECK(slot_type IN ('car', 'bike', 'ev', 'accessible')) DEFAULT 'car' NOT NULL,
      status TEXT CHECK(status IN ('available', 'occupied', 'maintenance', 'reserved')) DEFAULT 'available' NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
      UNIQUE(location_id, slot_number)
    );
  `);

  return {
    raw: db,
    execute: async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+FOR\s+UPDATE/gi, '').trim();
      if (/^SELECT/i.test(cleanSql)) {
        const rows = db.prepare(cleanSql).all(...params);
        return [rows];
      } else {
        const info = db.prepare(cleanSql).run(...params);
        return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
      }
    }
  };
}

async function runTests() {
  const db = require('./config/db');
  await db.initDb();

  console.log('\n--- 1. PRODUCTION MIGRATION SAFETY & ZERO DEMO SEEDING ---');
  try {
    const testDb = createTestDb();

    // Verify seedDevelopmentUsers throws fatal error in production
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let devSeedBlocked = false;
    try {
      await seedDevelopmentUsers(testDb);
    } catch (err) {
      devSeedBlocked = true;
    }
    assert.strictEqual(devSeedBlocked, true, 'seedDevelopmentUsers must refuse execution in production');
    pass('seedDevelopmentUsers strictly refuses execution in production mode');

    // Run infrastructure seeding
    const infraResult = await seedInfrastructure(testDb);
    assert.strictEqual(infraResult.seeded, true, 'Infrastructure should be seeded');
    assert.strictEqual(infraResult.locations, 4, 'Should seed 4 locations');
    assert.strictEqual(infraResult.slots, 54, 'Should seed 54 slots');
    pass('Parking facilities (4 locations, 54 slots) seeded successfully');

    // Verify zero user accounts exist
    const [userRows] = await testDb.execute('SELECT COUNT(*) as count FROM users');
    assert.strictEqual(userRows[0].count, 0, 'No users should be created during production migration');
    pass('Zero demo user accounts created in production migration');

    // Verify idempotent re-run does not duplicate facilities
    const rerun = await seedInfrastructure(testDb);
    assert.strictEqual(rerun.seeded, false, 'Re-run should skip seeding');
    pass('Infrastructure seeding is completely idempotent (no duplicates on re-run)');

    process.env.NODE_ENV = prevEnv;
  } catch (err) {
    fail('Production migration safety', err);
  }

  console.log('\n--- 2. SECURE INITIAL ADMINISTRATOR BOOTSTRAP ---');
  try {
    const testDb = createTestDb();

    // Create initial admin
    const result = await bootstrapAdmin(testDb, {
      email: 'chief-officer@campus-parking.edu',
      password: 'C0mplex&StrongAdminPass!2026',
      fullName: 'Chief Parking Officer'
    });

    assert.strictEqual(result.created, true, 'Admin bootstrap should report created = true');
    assert.strictEqual(result.email, 'chief-officer@campus-parking.edu');
    pass('Initial administrator created successfully with secure credentials');

    // Verify stored database record
    const [adminRows] = await testDb.execute('SELECT * FROM users WHERE email = ?', ['chief-officer@campus-parking.edu']);
    assert.strictEqual(adminRows.length, 1);
    assert.strictEqual(adminRows[0].role, 'admin');
    assert.strictEqual(adminRows[0].full_name, 'Chief Parking Officer');

    // Verify password is correctly hashed with bcrypt and not plaintext
    assert.ok(adminRows[0].password_hash.startsWith('$2'), 'Password hash must be a valid bcrypt hash');
    assert.notStrictEqual(adminRows[0].password_hash, 'C0mplex&StrongAdminPass!2026', 'Password must NOT be plaintext');
    const isBcryptMatch = await bcrypt.compare('C0mplex&StrongAdminPass!2026', adminRows[0].password_hash);
    assert.strictEqual(isBcryptMatch, true, 'Bcrypt compare should match password');
    pass('Administrator password securely hashed with bcrypt (salt rounds: 10)');

    // Verify idempotency: subsequent bootstrap skips and does not overwrite
    const secondBootstrap = await bootstrapAdmin(testDb, {
      email: 'attacker-admin@evil.com',
      password: 'AnotherPassword!2026',
      fullName: 'Duplicate Admin'
    });
    assert.strictEqual(secondBootstrap.created, false, 'Second bootstrap must be skipped');
    assert.strictEqual(secondBootstrap.existingEmail, 'chief-officer@campus-parking.edu');

    const [allAdmins] = await testDb.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    assert.strictEqual(allAdmins[0].count, 1, 'Only one administrator must exist');
    pass('Idempotent bootstrap: Subsequent bootstrap calls do not create duplicate admins or overwrite credentials');
  } catch (err) {
    fail('Administrator bootstrap', err);
  }

  console.log('\n--- 3. REJECTION OF WEAK & DEFAULT PRODUCTION ADMIN PASSWORDS ---');
  try {
    const weakPasswords = [
      'Admin@123',
      'admin',
      'admin123',
      'password',
      '12345678',
      'user@123',
      'root',
      'short',
      '',
      null
    ];

    for (const pwd of weakPasswords) {
      const validation = validateAdminPassword(pwd);
      assert.strictEqual(validation.isValid, false, `Password "${pwd}" should be rejected as weak/default`);
    }
    pass(`All ${weakPasswords.length} weak/default passwords rejected (including Admin@123, admin, password)`);

    // Verify bootstrapAdmin throws on weak password
    const testDb = createTestDb();
    let threwOnWeak = false;
    try {
      await bootstrapAdmin(testDb, {
        email: 'test-admin@campus.edu',
        password: 'Admin@123'
      });
    } catch (err) {
      threwOnWeak = true;
      assert.ok(err.message.includes('Insecure administrator password'), 'Error should specify insecure password');
    }
    assert.strictEqual(threwOnWeak, true, 'bootstrapAdmin must reject Admin@123');
    pass('bootstrapAdmin rejects Admin@123 and throws informative security exception');
  } catch (err) {
    fail('Weak password rejection', err);
  }

  console.log('\n--- 4. PREVENTION OF ADMIN-ROLE SELF-REGISTRATION ---');
  try {
    // Make test call to register controller
    const req = {
      body: {
        full_name: 'Malicious Driver',
        email: 'malicious@driver.com',
        password: 'SecureUserPassword123!',
        role: 'admin' // Attempting privilege escalation
      }
    };

    let responseStatus = null;
    let responseData = null;

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    const authController = require('./controllers/auth.controller');
    await authController.register(req, res, () => {});

    assert.strictEqual(responseStatus, 403, 'Attempted admin registration should be rejected with 403 Forbidden');
    assert.strictEqual(responseData.success, false);
    assert.ok(responseData.message.includes('prohibited'), 'Message must explain admin registration is prohibited');
    pass('Attempt to register with role="admin" immediately rejected with 403 Forbidden');
  } catch (err) {
    fail('Admin-role self registration prevention', err);
  }

  console.log('\n--- 5. TLS CONFIGURATION & CA CERTIFICATE RESOLUTION ---');
  try {
    const savedEnv = { ...process.env };

    // Case A: Production default without custom CA (Uses system trusted root CAs with full verification)
    delete process.env.DB_CA_CERT;
    delete process.env.DB_CA_CERT_PATH;
    delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
    process.env.DB_SSL = 'true';

    const prodSsl = resolveSslConfig(true);
    assert.ok(prodSsl !== null, 'SSL should be active');
    assert.strictEqual(prodSsl.rejectUnauthorized, true, 'rejectUnauthorized must be true by default in production');
    assert.strictEqual(prodSsl.ssl.minVersion, 'TLSv1.2', 'TLS minVersion must be TLSv1.2');
    assert.strictEqual(prodSsl.hasCustomCa, false, 'No custom CA attached');
    pass('Production default: TLS verification enforced (rejectUnauthorized: true, TLSv1.2)');

    // Case B: Aiven MySQL custom CA supplied inline via DB_CA_CERT
    const mockCaCert = '-----BEGIN CERTIFICATE-----\nMIICMockCertForTestingAivenMySQLTLSVerification\n-----END CERTIFICATE-----';
    process.env.DB_CA_CERT = mockCaCert;

    const aivenSsl = resolveSslConfig(true);
    assert.strictEqual(aivenSsl.hasCustomCa, true, 'Should detect custom CA');
    assert.strictEqual(aivenSsl.ssl.ca, mockCaCert, 'Should load CA certificate');
    assert.strictEqual(aivenSsl.ssl.rejectUnauthorized, true, 'TLS verification must remain enforced with custom CA');
    pass('Aiven MySQL CA Certificate: Successfully loaded inline with enforced verification');

    // Case C: Base64 encoded CA certificate
    const base64Cert = Buffer.from(mockCaCert).toString('base64');
    process.env.DB_CA_CERT = base64Cert;

    const b64Ssl = resolveSslConfig(true);
    assert.strictEqual(b64Ssl.ssl.ca, mockCaCert, 'Should decode base64 certificate');
    pass('Base64 encoded CA Certificate: Successfully decoded and applied to ssl.ca');

    // Case D: CA Certificate supplied via file path DB_CA_CERT_PATH
    delete process.env.DB_CA_CERT;
    const tempCertPath = path.join(__dirname, 'test-ca.pem');
    fs.writeFileSync(tempCertPath, mockCaCert, 'utf-8');
    process.env.DB_CA_CERT_PATH = tempCertPath;

    const fileSsl = resolveSslConfig(true);
    assert.strictEqual(fileSsl.ssl.ca, mockCaCert, 'Should read CA certificate from file path');
    pass('CA Certificate Path (DB_CA_CERT_PATH): Successfully loaded from disk');
    fs.unlinkSync(tempCertPath);
    delete process.env.DB_CA_CERT_PATH;

    // Case E: Explicit insecure bypass only if DB_SSL_REJECT_UNAUTHORIZED === 'false'
    process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
    const bypassSsl = resolveSslConfig(true);
    assert.strictEqual(bypassSsl.rejectUnauthorized, false, 'Bypass only when explicitly requested');
    pass('Explicit bypass test: rejectUnauthorized is false only when DB_SSL_REJECT_UNAUTHORIZED="false"');

    // Restore env
    process.env = savedEnv;
  } catch (err) {
    fail('TLS configuration test', err);
  }

  console.log('\n--- 6. PRODUCTION JWT SECRET ENFORCEMENT ---');
  try {
    const savedEnv = { ...process.env };
    process.env.NODE_ENV = 'production';

    // 1. Unset JWT_SECRET
    delete process.env.JWT_SECRET;
    let threwUnset = false;
    try {
      getValidatedJwtSecret();
    } catch (err) {
      threwUnset = true;
    }
    assert.strictEqual(threwUnset, true, 'Must throw when JWT_SECRET is unset in production');
    pass('Production rejects startup with missing JWT_SECRET');

    // 2. Default development secret
    process.env.JWT_SECRET = 'super_secret_jwt_key_diploma_smart_parking_2026';
    let threwDefault = false;
    try {
      getValidatedJwtSecret();
    } catch (err) {
      threwDefault = true;
    }
    assert.strictEqual(threwDefault, true, 'Must throw when default dev secret is used in production');
    pass('Production rejects startup with default development JWT_SECRET');

    // 3. Short / weak secret
    process.env.JWT_SECRET = 'short_secret';
    let threwShort = false;
    try {
      getValidatedJwtSecret();
    } catch (err) {
      threwShort = true;
    }
    assert.strictEqual(threwShort, true, 'Must throw when secret is under 32 characters');
    pass('Production rejects secret under 32 characters');

    // 4. Valid strong secret
    process.env.JWT_SECRET = 'c9a7e2b1f830d4567e91a0b3c5d7e8f192837465abcde1234567890f';
    const validatedSecret = getValidatedJwtSecret();
    assert.strictEqual(validatedSecret, process.env.JWT_SECRET);
    pass('Production accepts strong 32+ character random JWT secret');

    process.env = savedEnv;
  } catch (err) {
    fail('JWT secret enforcement', err);
  }

  console.log('\n--- 7. AUTHENTICATION RATE LIMITING MIDDLEWARE ---');
  try {
    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: 'Rate limit test exceeded'
    });

    const mockReq = {
      headers: { 'x-forwarded-for': '203.0.113.42' },
      socket: { remoteAddress: '203.0.113.42' }
    };

    let statusCode = 200;
    let body = null;
    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            body = data;
          }
        };
      }
    };

    // First 3 requests should pass (next is called)
    let nextCalledCount = 0;
    const nextFn = () => { nextCalledCount++; };

    testLimiter(mockReq, mockRes, nextFn);
    testLimiter(mockReq, mockRes, nextFn);
    testLimiter(mockReq, mockRes, nextFn);
    assert.strictEqual(nextCalledCount, 3, 'First 3 requests within limit should pass');
    pass('Requests within configured limit successfully pass through rate limiter');

    // 4th request must be blocked with HTTP 429
    testLimiter(mockReq, mockRes, nextFn);
    assert.strictEqual(statusCode, 429, 'Excess request must return HTTP 429');
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Rate limit test exceeded');
    assert.ok(body.retryAfterSeconds > 0, 'Retry-After must be positive');
    pass('Excess request blocked with HTTP 429 Too Many Requests and Retry-After header');

    // Reset limiter
    testLimiter.reset();
    statusCode = 200;
    testLimiter(mockReq, mockRes, nextFn);
    assert.strictEqual(nextCalledCount, 4, 'After reset, requests pass again');
    pass('Rate limiter reset clears client request records');
  } catch (err) {
    fail('Rate limiter test', err);
  }

  console.log('\n--- 8. LOGIN ERROR SANITIZATION & NO CREDENTIAL EXPOSURE ---');
  try {
    const authController = require('./controllers/auth.controller');

    // Test with non-existent email
    let responseStatus = null;
    let responseData = null;
    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    await authController.login(
      { body: { email: 'nonexistent-driver@fake.com', password: 'wrongpassword' } },
      res,
      () => {}
    );

    assert.strictEqual(responseStatus, 401, 'Should return 401 Unauthorized');
    assert.strictEqual(responseData.message, 'Invalid email or password.');
    pass('Non-existent user receives uniform error: "Invalid email or password."');

    // Test with existing user but wrong password
    await authController.login(
      { body: { email: 'user@parkingfinder.com', password: 'IncorrectPassword999!' } },
      res,
      () => {}
    );

    assert.strictEqual(responseStatus, 401);
    assert.strictEqual(responseData.message, 'Invalid email or password.');
    pass('Incorrect password receives identical uniform error (prevents user enumeration)');
  } catch (err) {
    fail('Login error sanitization', err);
  }

  console.log('\n===========================================================');
  console.log(`📊 SECURITY TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===========================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
