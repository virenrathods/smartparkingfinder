const crypto = require('crypto');

/**
 * Generate a unique, readable booking code like SPF-202610-8A4B
 */
function generateBookingCode() {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SPF-${yearMonth}-${randomHex}`;
}

/**
 * Calculate total hours between two dates, minimum 1 hour, rounded up
 */
function calculateDurationHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 1;
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  return Math.max(1, hours);
}

/**
 * Format Date or ISO string into appropriate database datetime string:
 * - MySQL: YYYY-MM-DD HH:MM:SS (strictly required by MySQL DATETIME columns)
 * - SQLite: ISO-8601 string (preserves existing SQLite text comparison compatibility)
 */
function formatSqlDatetime(date, clientType = null) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  const type = clientType || (process.env.DB_CLIENT === 'mysql' || (process.env.NODE_ENV === 'production' && process.env.DB_CLIENT !== 'sqlite') ? 'mysql' : 'sqlite');
  if (type === 'mysql') {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return d.toISOString();
}

module.exports = {
  generateBookingCode,
  calculateDurationHours,
  formatSqlDatetime
};
