#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');
const { bootstrapAdmin } = require('./bootstrap');

async function main() {
  console.log('====================================================');
  console.log('🛡️  Smart Parking Finder — Administrator Bootstrap');
  console.log('====================================================');

  // Parse CLI args (e.g. --email admin@domain.com --password SecretPass123!)
  const args = process.argv.slice(2);
  let email = process.env.INITIAL_ADMIN_EMAIL;
  let password = process.env.INITIAL_ADMIN_PASSWORD;
  let fullName = process.env.INITIAL_ADMIN_NAME || 'System Administrator';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      fullName = args[i + 1];
      i++;
    }
  }

  if (!email || !password) {
    console.error('❌ Error: Administrator email and password must be provided.');
    console.error('');
    console.error('Usage options:');
    console.error('  1. Environment variables:');
    console.error('     INITIAL_ADMIN_EMAIL="admin@domain.com" INITIAL_ADMIN_PASSWORD="StrongPassword2026!" npm run bootstrap:admin');
    console.error('');
    console.error('  2. CLI arguments:');
    console.error('     node database/bootstrap-admin.js --email admin@domain.com --password StrongPassword2026!');
    console.error('');
    console.error('Note: Weak or default passwords (such as Admin@123, admin, password) are rejected.');
    process.exit(1);
  }

  try {
    await db.initDb();
    const result = await bootstrapAdmin(db, { email, password, fullName });

    if (result.created) {
      console.log(`✅ Administrator account created successfully:`);
      console.log(`   - Email: ${result.email}`);
      console.log(`   - Role:  admin`);
      if (result.elevated) {
        console.log(`   - Status: Existing account elevated to Administrator.`);
      }
      console.log('🔒 Password securely hashed with bcrypt (salt rounds: 10).');
    } else {
      console.log(`ℹ️  ${result.message}`);
      if (result.existingEmail) {
        console.log(`   - Existing administrator: ${result.existingEmail}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(`❌ Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
