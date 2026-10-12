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

module.exports = {
  generateBookingCode,
  calculateDurationHours
};
