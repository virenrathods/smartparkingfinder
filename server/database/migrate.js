const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const {
  bootstrapAdmin,
  seedInfrastructure,
  seedDevelopmentUsers,
  cleanSqlStatements
} = require('./bootstrap');

async function runMigration() {
  console.log('🔄 Initializing database migration...');
  await db.initDb();

  const clientType = db.getClientType();
  console.log(`ℹ️  Active Database Engine: ${clientType.toUpperCase()}`);

  // 1. Apply Schema DDL (For MySQL databases)
  if (clientType === 'mysql') {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = cleanSqlStatements(schemaSql);

    console.log(`📋 Applying ${statements.length} MySQL schema statements...`);
    for (const statement of statements) {
      await db.execute(statement);
    }
    console.log('✅ MySQL schema verified / applied successfully.');
  }

  // 2. Seed Facility Infrastructure (Locations & Slots)
  // Safe for all environments; only seeds if table is empty
  const infraResult = await seedInfrastructure(db);
  if (!infraResult.seeded) {
    console.log(`ℹ️  Parking facilities already populated (${infraResult.count} locations).`);
  }

  // 3. User & Administrator Handling by Environment
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log('🛡️  Production mode active: Automatic demo user seeding is DISABLED.');

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminName = process.env.INITIAL_ADMIN_NAME || 'Production Administrator';

    if (adminEmail && adminPassword) {
      try {
        const bootstrapResult = await bootstrapAdmin(db, {
          email: adminEmail,
          password: adminPassword,
          fullName: adminName
        });

        if (bootstrapResult.created) {
          console.log(`✅ [Admin Bootstrap] Initial production administrator created for ${bootstrapResult.email}.`);
        } else {
          console.log(`ℹ️  [Admin Bootstrap] ${bootstrapResult.message}`);
        }
      } catch (err) {
        console.error(`❌ [Admin Bootstrap Error] ${err.message}`);
        throw err;
      }
    } else {
      const [admins] = await db.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      const adminCount = admins[0].count;
      if (adminCount === 0) {
        console.warn('⚠️  [Production Warning] No administrator account exists yet.');
        console.warn('ℹ️  Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD in hosting dashboard or run: npm run bootstrap:admin');
      } else {
        console.log(`ℹ️  Database contains ${adminCount} registered administrator(s).`);
      }
    }
  } else {
    // Development mode: seed development demo accounts if no users exist
    const devSeedResult = await seedDevelopmentUsers(db);
    if (!devSeedResult.seeded) {
      console.log('ℹ️  User table already populated. Skipping demo user seeding.');
    }
  }
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
