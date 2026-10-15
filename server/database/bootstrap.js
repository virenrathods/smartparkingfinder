const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DISALLOWED_PASSWORDS = new Set([
  'admin@123',
  'admin',
  'admin123',
  'admin2026',
  'admin@2026',
  'user@123',
  'user',
  'password',
  'password123',
  '12345678',
  '123456789',
  '123456',
  'root',
  'root123',
  'qwerty',
  'changeme',
  'smartparking',
  'administrator',
  'superadmin',
  'welcome123'
]);

/**
 * Validates password strength for production administrators.
 * Prevents empty, short, or known default/demo passwords.
 */
function validateAdminPassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      reason: 'Password cannot be empty.'
    };
  }

  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return {
      isValid: false,
      reason: 'Password must be at least 8 characters long (12+ recommended for production).'
    };
  }

  if (DISALLOWED_PASSWORDS.has(trimmed.toLowerCase())) {
    return {
      isValid: false,
      reason: 'Default, demo, or dictionary passwords (e.g., Admin@123) are strictly prohibited for production administrators.'
    };
  }

  return { isValid: true };
}

/**
 * Clean SQL statements by stripping comments and splitting by semicolon
 */
function cleanSqlStatements(rawSql) {
  return rawSql
    .split(';')
    .map(statement => statement.replace(/--.*$/gm, '').trim())
    .filter(statement => statement.length > 0);
}

/**
 * Securely bootstrap the first production administrator account.
 * Ensures the password is validated, hashed with bcrypt, and never logged.
 * Idempotent: Does not create duplicate administrators if one already exists.
 */
async function bootstrapAdmin(db, { email, password, fullName }) {
  if (!email || !password) {
    throw new Error('Both email and password are required to bootstrap an administrator.');
  }

  const cleanEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error(`Invalid administrator email format: "${cleanEmail}".`);
  }

  // Validate password strength
  const validation = validateAdminPassword(password);
  if (!validation.isValid) {
    throw new Error(`Insecure administrator password: ${validation.reason}`);
  }

  // Check if an administrator already exists
  const [existingAdmins] = await db.execute("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
  if (existingAdmins && existingAdmins.length > 0) {
    return {
      created: false,
      existingEmail: existingAdmins[0].email,
      message: 'An administrator account already exists. Bootstrap skipped.'
    };
  }

  // Check if this specific email is already registered with another role
  const [existingUser] = await db.execute('SELECT id, role FROM users WHERE email = ?', [cleanEmail]);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existingUser && existingUser.length > 0) {
    // Elevate existing user to admin with new secure password
    await db.execute(
      "UPDATE users SET role = 'admin', password_hash = ?, full_name = ? WHERE id = ?",
      [passwordHash, fullName || 'System Administrator', existingUser[0].id]
    );
    return {
      created: true,
      elevated: true,
      id: existingUser[0].id,
      email: cleanEmail
    };
  }

  // Insert new administrator
  const [result] = await db.execute(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    [fullName || 'System Administrator', cleanEmail, passwordHash]
  );

  return {
    created: true,
    id: result.insertId,
    email: cleanEmail
  };
}

/**
 * Seed initial parking infrastructure (locations and slots).
 * Safe for both production and development environments.
 */
async function seedInfrastructure(db) {
  const [locRows] = await db.execute('SELECT COUNT(*) as count FROM parking_locations');
  if (locRows[0].count > 0) {
    return { seeded: false, count: locRows[0].count };
  }

  const seedPath = path.join(__dirname, 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');
  const statements = cleanSqlStatements(seedSql);

  // Execute only parking_locations and parking_slots statements (skip users table insert)
  let count = 0;
  for (const stmt of statements) {
    if (/INSERT\s+INTO\s+parking_locations/i.test(stmt) || /INSERT\s+INTO\s+parking_slots/i.test(stmt)) {
      await db.execute(stmt);
      count++;
    }
  }

  const [verifyLocs] = await db.execute('SELECT COUNT(*) as count FROM parking_locations');
  const [verifySlots] = await db.execute('SELECT COUNT(*) as count FROM parking_slots');

  console.log(`✅ Seeded parking facilities: ${verifyLocs[0].count} locations, ${verifySlots[0].count} slots.`);
  return { seeded: true, locations: verifyLocs[0].count, slots: verifySlots[0].count };
}

/**
 * Seed sample demo users for local development only.
 * STRICTLY forbidden in production mode.
 */
async function seedDevelopmentUsers(db) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fatal Security Violation: seedDevelopmentUsers must NEVER be called in production mode.');
  }

  const [userRows] = await db.execute('SELECT COUNT(*) as count FROM users');
  if (userRows[0].count > 0) {
    return { seeded: false, count: userRows[0].count };
  }

  const seedPath = path.join(__dirname, 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');
  const statements = cleanSqlStatements(seedSql);

  for (const stmt of statements) {
    if (/INSERT\s+INTO\s+users/i.test(stmt)) {
      await db.execute(stmt);
    }
  }

  console.log('🌱 Seeded local development demo users:');
  console.log('   - Admin Login: admin@parkingfinder.com / Admin@123');
  console.log('   - User Login:  user@parkingfinder.com / User@123');

  return { seeded: true };
}

module.exports = {
  validateAdminPassword,
  bootstrapAdmin,
  seedInfrastructure,
  seedDevelopmentUsers,
  cleanSqlStatements
};
