#!/usr/bin/env node

/**
 * Database Health Check Script
 * Verifies database connection and checks table integrity
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../config/database');
const logger = require('../utils/logger.util');

async function checkDatabase() {
  console.log('🔍 Running Database Health Check...\n');

  const checks = {
    connection: false,
    tables: [],
    missingTables: [],
    indexCount: 0,
    recordCounts: {},
  };

  // 1. Check connection
  try {
    await query('SELECT 1');
    checks.connection = true;
    console.log('✅ Database connection: OK');
  } catch (err) {
    console.error('❌ Database connection: FAILED');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  // 2. Check required tables exist
  const requiredTables = [
    'users', 'patients', 'doctors', 'appointments', 'consultations',
    'symptom_reports', 'vital_signs', 'medical_documents', 'notifications',
    'hospitals', 'hospital_doctors', 'hospital_patients', 'test_results',
    'payments', 'reviews', 'waitlist_entries', 'emergency_contacts',
    'prescriptions', 'health_records', 'otp_codes', 'refresh_tokens',
  ];

  try {
    const tables = await query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    checks.tables = tableNames;

    for (const tableName of requiredTables) {
      if (tableNames.includes(tableName)) {
        console.log(`✅ Table '${tableName}': EXISTS`);
      } else {
        console.log(`❌ Table '${tableName}': MISSING`);
        checks.missingTables.push(tableName);
      }
    }
  } catch (err) {
    console.error('❌ Error checking tables:', err.message);
  }

  // 3. Check indexes
  try {
    const indexes = await query(`
      SELECT COUNT(*) as count
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
    `);
    checks.indexCount = indexes[0].count;
    console.log(`\n📊 Total indexes: ${checks.indexCount}`);
  } catch (err) {
    console.error('❌ Error checking indexes:', err.message);
  }

  // 4. Check record counts
  console.log('\n📈 Record Counts:');
  const countTables = ['users', 'patients', 'doctors', 'appointments', 'hospitals'];
  for (const table of countTables) {
    try {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      checks.recordCounts[table] = result[0].count;
      console.log(`   ${table}: ${result[0].count}`);
    } catch (err) {
      console.log(`   ${table}: ERROR (${err.message})`);
    }
  }

  // 5. Check database size
  try {
    const sizeResult = await query(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    console.log(`\n💾 Database size: ${sizeResult[0].size_mb} MB`);
  } catch (err) {
    console.error('❌ Error checking database size:', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (checks.missingTables.length === 0) {
    console.log('✅ Database health check: PASSED');
    process.exit(0);
  } else {
    console.log('⚠️  Database health check: ISSUES FOUND');
    console.log(`   Missing tables: ${checks.missingTables.join(', ')}`);
    console.log('\n   Run: mysql -u root -p < backend/database/schema.sql');
    process.exit(1);
  }
}

checkDatabase().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
