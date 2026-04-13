import "dotenv/config";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sqlPath = join(__dirname, "..", "migrations", "0001_add_users_demo_event_id.sql");
const sql = readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("OK: users.demo_event_id is present (migration idempotent).");
} finally {
  await pool.end();
}
