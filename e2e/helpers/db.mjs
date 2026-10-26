import pg from "pg";
import { E2E_DB_URL } from "../playwright.config.ts";

export function pool() {
  return new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL || E2E_DB_URL });
}

export async function query(text, params) {
  const p = pool();
  try {
    return await p.query(text, params);
  } finally {
    await p.end();
  }
}