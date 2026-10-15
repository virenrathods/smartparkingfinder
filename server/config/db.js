const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let activeClient = 'mysql';
let pool = null;
let sqliteDb = null;
const dbDir = path.join(__dirname, '../database');
const dbPath = path.join(dbDir, 'smart_parking.db');

// Simple async mutex for serializing SQLite transactions
let sqliteTxMutex = Promise.resolve();

/**
 * Configure TLS/SSL parameters for MySQL connections.
 * Enforces TLS certificate verification by default in production.
 * Supports provider CA certificates via DB_CA_CERT (inline PEM / base64) or DB_CA_CERT_PATH.
 */
function resolveSslConfig(isProduction = false) {
  const enableSsl = process.env.DB_SSL === 'true' ||
                    process.env.DB_SSL === '1' ||
                    (isProduction && process.env.DB_SSL !== 'false');

  if (!enableSsl) {
    return null;
  }

  let caCert = null;
  if (process.env.DB_CA_CERT) {
    let rawCert = process.env.DB_CA_CERT.trim();
    if (rawCert.includes('\\n')) {
      rawCert = rawCert.replace(/\\n/g, '\n');
    }
    if (rawCert.includes('-----BEGIN CERTIFICATE-----')) {
      caCert = rawCert;
    } else {
      try {
        const decoded = Buffer.from(rawCert, 'base64').toString('utf-8');
        if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
          caCert = decoded;
        } else {
          caCert = rawCert;
        }
      } catch (_) {
        caCert = rawCert;
      }
    }
  } else if (process.env.DB_CA_CERT_PATH) {
    const certPath = path.isAbsolute(process.env.DB_CA_CERT_PATH)
      ? process.env.DB_CA_CERT_PATH
      : path.resolve(process.cwd(), process.env.DB_CA_CERT_PATH);

    if (fs.existsSync(certPath)) {
      caCert = fs.readFileSync(certPath, 'utf-8');
    } else {
      throw new Error(`Database CA certificate file not found at: ${process.env.DB_CA_CERT_PATH}`);
    }
  }

  // In production, rejectUnauthorized MUST default to true.
  // Verification is only bypassed if explicitly instructed by setting DB_SSL_REJECT_UNAUTHORIZED='false'.
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

  if (!rejectUnauthorized) {
    console.warn('⚠️  [Database Security Notice] DB_SSL_REJECT_UNAUTHORIZED is explicitly set to "false". TLS certificate verification is bypassed.');
  }

  const ssl = {
    rejectUnauthorized,
    minVersion: 'TLSv1.2'
  };

  if (caCert) {
    ssl.ca = caCert;
  }

  return {
    ssl,
    rejectUnauthorized,
    hasCustomCa: Boolean(caCert)
  };
}

// Initialize Database Connection
async function initDb() {
  const preferredClient = process.env.DB_CLIENT || (process.env.NODE_ENV === 'production' ? 'mysql' : 'auto');
  const isProduction = process.env.NODE_ENV === 'production';

  if (preferredClient !== 'sqlite') {
    try {
      const mysql = require('mysql2/promise');

      let poolConfig;
      if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        poolConfig = {
          host: url.hostname,
          port: Number(url.port) || 3306,
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: url.pathname.replace(/^\//, ''),
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0
        };
      } else {
        poolConfig = {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 3306,
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'smart_parking_db',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0
        };
      }

      // Configure TLS/SSL for hosted cloud MySQL providers
      const sslInfo = resolveSslConfig(isProduction);
      if (sslInfo) {
        poolConfig.ssl = sslInfo.ssl;
      }

      const testPool = mysql.createPool(poolConfig);

      const conn = await testPool.getConnection();
      await conn.ping();
      conn.release();

      const tlsStatus = sslInfo
        ? (sslInfo.rejectUnauthorized ? 'Verified TLS' : 'Unverified TLS (Insecure)')
        : 'Disabled';
      const caStatus = sslInfo && sslInfo.hasCustomCa ? ' [Custom CA loaded]' : '';
      console.log(`✅ Connected to MySQL database at ${poolConfig.host}:${poolConfig.port}/${poolConfig.database} (SSL: ${tlsStatus}${caStatus})`);
      pool = testPool;
      activeClient = 'mysql';
      return;
    } catch (err) {
      if (isProduction || preferredClient === 'mysql') {
        console.error('❌ [Database] Production MySQL connection failed:', err.message);
        console.error('❌ [Database] In production mode (NODE_ENV=production or DB_CLIENT=mysql), a genuine MySQL-compatible database is required.');
        console.error('❌ [Database] Please configure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME (or DATABASE_URL) in your hosting environment settings.');
        throw new Error(`Production database connection failed: ${err.message}`);
      }
      console.warn('⚠️  MySQL not reachable at localhost:3306 (' + err.message + ').');
      console.log('🔄 Activating high-performance local SQLite database with full ACID transactions.');
    }
  }

  // SQLite fallback with better-sqlite3
  const Database = require('better-sqlite3');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  sqliteDb = new Database(dbPath, { timeout: 10000 });
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  activeClient = 'sqlite';
  console.log('✅ Connected to SQLite database at:', dbPath);

  // Initialize SQLite schema if tables don't exist
  initSqliteSchema(sqliteDb);
}

function initSqliteSchema(db) {
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

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      total_amount REAL NOT NULL,
      booking_status TEXT CHECK(booking_status IN ('confirmed', 'completed', 'cancelled', 'expired')) DEFAULT 'confirmed' NOT NULL,
      vehicle_number TEXT,
      check_in_time DATETIME,
      check_out_time DATETIME,
      qr_code_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (location_id) REFERENCES parking_locations(id),
      FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
    );

    CREATE TABLE IF NOT EXISTS slot_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER NOT NULL,
      changed_by INTEGER NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slot_id) REFERENCES parking_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      booking_code TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      notification_type TEXT CHECK(notification_type IN ('confirmation', 'cancellation', 'reminder')) NOT NULL,
      delivery_status TEXT CHECK(delivery_status IN ('sent', 'failed', 'skipped', 'pending')) DEFAULT 'pending' NOT NULL,
      attempt_count INTEGER DEFAULT 0 NOT NULL,
      error_message TEXT,
      last_attempt_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
  `);

  // Ensure SQLite bookings table supports 'expired' status
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get();
    if (tableInfo && !tableInfo.sql.includes('expired')) {
      db.exec(`
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;
        CREATE TABLE bookings_p3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_code TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          location_id INTEGER NOT NULL,
          slot_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          total_amount REAL NOT NULL,
          booking_status TEXT CHECK(booking_status IN ('confirmed', 'completed', 'cancelled', 'expired')) DEFAULT 'confirmed' NOT NULL,
          vehicle_number TEXT,
          check_in_time DATETIME,
          check_out_time DATETIME,
          qr_code_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (location_id) REFERENCES parking_locations(id),
          FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
        );
        INSERT INTO bookings_p3 SELECT * FROM bookings;
        DROP TABLE bookings;
        ALTER TABLE bookings_p3 RENAME TO bookings;
        COMMIT;
        PRAGMA foreign_keys=ON;
      `);
      console.log('✅ SQLite bookings table migrated to support "expired" status.');
    }
  } catch (err) {
    console.error('SQLite schema check warning:', err.message);
  }
}

// Unified Query and Execution Interface
async function execute(sql, params = []) {
  if (activeClient === 'mysql') {
    return await pool.execute(sql, params);
  }

  const cleanSql = sql.replace(/\s+FOR\s+UPDATE/gi, '');
  const trimmed = cleanSql.trim();
  const isSelect = /^SELECT/i.test(trimmed);

  if (isSelect) {
    const stmt = sqliteDb.prepare(cleanSql);
    const rows = stmt.all(...params);
    return [rows];
  } else {
    const stmt = sqliteDb.prepare(cleanSql);
    const info = stmt.run(...params);
    return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
  }
}

async function query(sql, params = []) {
  return execute(sql, params);
}

// Transaction Connection Provider
async function getConnection() {
  if (activeClient === 'mysql') {
    return await pool.getConnection();
  }

  // SQLite transaction lock manager
  let releaseMutex = null;
  const mutexPromise = new Promise((resolve) => {
    releaseMutex = resolve;
  });

  const previousMutex = sqliteTxMutex;
  sqliteTxMutex = (async () => {
    await previousMutex;
    await mutexPromise;
  })();

  await previousMutex;

  let inTransaction = false;

  return {
    beginTransaction: async () => {
      sqliteDb.exec('BEGIN IMMEDIATE');
      inTransaction = true;
    },
    commit: async () => {
      if (inTransaction) {
        sqliteDb.exec('COMMIT');
        inTransaction = false;
      }
    },
    rollback: async () => {
      if (inTransaction) {
        sqliteDb.exec('ROLLBACK');
        inTransaction = false;
      }
    },
    execute: async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+FOR\s+UPDATE/gi, '');
      const trimmed = cleanSql.trim();
      const isSelect = /^SELECT/i.test(trimmed);

      if (isSelect) {
        const stmt = sqliteDb.prepare(cleanSql);
        const rows = stmt.all(...params);
        return [rows];
      } else {
        const stmt = sqliteDb.prepare(cleanSql);
        const info = stmt.run(...params);
        return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
      }
    },
    release: () => {
      if (releaseMutex) {
        releaseMutex();
        releaseMutex = null;
      }
    }
  };
}

module.exports = {
  initDb,
  execute,
  query,
  getConnection,
  getClientType: () => activeClient,
  getRawSqlite: () => sqliteDb,
  resolveSslConfig
};
