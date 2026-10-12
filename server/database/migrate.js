const path = require('path');
const fs = require('fs');
const db = require('../config/db');

function cleanSqlStatements(rawSql) {
  return rawSql
    .split(';')
    .map(statement => {
      // Strip line comments
      const cleaned = statement
        .replace(/--.*$/gm, '')
        .trim();
      return cleaned;
    })
    .filter(statement => statement.length > 0);
}

async function runMigration() {
  console.log('🔄 Initializing database migration...');
  await db.initDb();

  const clientType = db.getClientType();
  console.log(`ℹ️  Active Database Engine: ${clientType.toUpperCase()}`);

  if (clientType === 'mysql') {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = cleanSqlStatements(schemaSql);

    console.log(`📋 Applying ${statements.length} MySQL schema statements...`);
    for (const statement of statements) {
      await db.execute(statement);
    }
    console.log('✅ MySQL schema applied successfully.');
  }

  // Check if users exist to determine if seed is needed
  const [existingUsers] = await db.execute('SELECT COUNT(*) as count FROM users');
  const userCount = existingUsers[0].count;

  if (userCount > 0) {
    console.log(`ℹ️  Database already contains ${userCount} users. Skipping seed.`);
    return;
  }

  console.log('🌱 Seeding database with realistic parking locations, slots, and test accounts...');
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  const seedStatements = cleanSqlStatements(seedSql);

  for (const statement of seedStatements) {
    await db.execute(statement);
  }

  const [verifyUsers] = await db.execute('SELECT COUNT(*) as count FROM users');
  const [verifyLocs] = await db.execute('SELECT COUNT(*) as count FROM parking_locations');
  const [verifySlots] = await db.execute('SELECT COUNT(*) as count FROM parking_slots');

  console.log(`✅ Database seeded successfully! (${verifyUsers[0].count} users, ${verifyLocs[0].count} locations, ${verifySlots[0].count} slots)`);
  console.log('   - Admin Login: admin@parkingfinder.com / Admin@123');
  console.log('   - User Login:  user@parkingfinder.com / User@123');
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🚀 Migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;
