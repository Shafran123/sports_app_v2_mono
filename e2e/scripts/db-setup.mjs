// Creates a fresh throwaway database for the e2e run: drop if present,
// recreate, migrate, seed, then apply the e2e fixtures. The backend boots
// against this same database (playwright.config.ts BACKEND_ENV.DATABASE_URL).
// NOTE: this must run BEFORE `playwright test` — Playwright starts webServer
// before globalSetup, so the orchestrator (scripts/run.mjs) calls this first.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spBe = path.resolve(root, "../sp_be");
const adminUrl = process.env.E2E_ADMIN_DATABASE_URL || "postgres://localhost:5432/postgres";
const dbName = process.env.E2E_DATABASE_NAME || "sports_e2e";
const databaseUrl = `postgres://localhost:5432/${dbName}`;

async function main() {
  const { Client } = pg;
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query(`drop database if exists "${dbName}" with (force)`);
  await client.query(`create database "${dbName}"`);
  await client.end();

  console.log(`[e2e] fresh database "${dbName}" created`);

  execSync("node scripts/migrate.js", {
    cwd: spBe,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit"
  });
  execSync("node scripts/seed.js", {
    cwd: spBe,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit"
  });
  execSync("node fixtures/fixtures.mjs", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit"
  });

  console.log("[e2e] database migrated, seeded, and fixtures applied");
}

main().catch((err) => {
  console.error("Database setup failed:", err.message);
  process.exit(1);
});