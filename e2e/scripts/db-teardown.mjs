import pg from "pg";

const adminUrl = process.env.E2E_ADMIN_DATABASE_URL || "postgres://localhost:5432/postgres";
const dbName = process.env.E2E_DATABASE_NAME || "sports_e2e";

async function main() {
  const { Client } = pg;
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query(`drop database if exists "${dbName}" with (force)`);
  await client.end();
  console.log(`[e2e] dropped database "${dbName}"`);
}

main().catch((err) => {
  console.error("Database teardown failed:", err.message);
  process.exit(1);
});