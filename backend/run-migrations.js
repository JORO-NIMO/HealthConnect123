const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'rambill1008',
  database: 'healthconnect',
  multipleStatements: true
};

async function runMigrations() {
  const connection = await mysql.createConnection(dbConfig);
  const dbDir = './database';
  const files = [
    'schema.sql',
    'migrations.sql',
    'hospital_migration.sql',
    'optimizations.sql',
    'fix_schema_mismatches.sql',
    'seeds.sql'
  ];

  for (const file of files) {
    const filePath = path.join(dbDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${file} not found`);
      continue;
    }
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`RUNNING: ${file}...`);
      const results = await connection.query(sql);
      console.log(`SUCCESS: ${file} completed`);
    } catch (err) {
      console.error(`ERROR: ${file} failed - ${err.message}`);
    }
  }

  await connection.end();
  console.log('All migrations completed');
}

runMigrations().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
