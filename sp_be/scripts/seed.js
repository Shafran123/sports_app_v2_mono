require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SEED_FILE = path.join(__dirname, '..', 'migrations', '0002_seed.sql');

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL env var is required (e.g. postgres://localhost:5432/sports_dev).');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const sql = fs.readFileSync(SEED_FILE, 'utf8');
    await pool.query(sql);
    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
