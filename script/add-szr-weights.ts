/**
 * One-time script to add the szr_weights column to events table.
 * Run with: npx tsx script/add-szr-weights.ts
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS szr_weights TEXT;
    `);
    console.log("Added szr_weights column to events table (or it already existed)");
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
