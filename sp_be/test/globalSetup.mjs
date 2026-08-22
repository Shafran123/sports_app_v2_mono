import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default async function setup(project) {
  const { Pool, Client } = pg;
  const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || 'postgres://localhost:5432/postgres';
  const dbName = `sports_test_${crypto.randomBytes(4).toString('hex')}`;
  const databaseUrl = `postgres://localhost:5432/${dbName}`;

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query(`create database "${dbName}"`);
  await client.end();

  execSync('node scripts/migrate.js', { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' });
  execSync('node scripts/seed.js', { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit' });

  project.provide('databaseUrl', databaseUrl);
  project.provide('dbName', dbName);
  project.provide('adminUrl', adminUrl);
}
