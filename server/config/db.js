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

// Initialize Database Connection
async function initDb() {
  const preferredClient = process.env.DB_CLIENT || 'auto';

  if (preferredClient !== 'sqlite') {
    try {
      const mysql = require('mysql2/promise');
      const testPool = mysql.createPool({
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
      });

      const conn = await testPool.getConnection();
      await conn.ping();
      conn.release();

      console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'smart_parking_db');
      pool = testPool;
      activeClient = 'mysql';
      return;
    } catch (err) {
      if (preferredClient === 'mysql') {
        console.error('❌ Failed to connect to MySQL:', err.message);
        throw err;
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
      booking_status TEXT CHECK(booking_status IN ('confirmed', 'completed', 'cancelled')) DEFAULT 'confirmed' NOT NULL,
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
  `);
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
  getRawSqlite: () => sqliteDb
};
