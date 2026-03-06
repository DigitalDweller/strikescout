/**
 * Verify scouter stats match actual database state.
 * Run with: npx tsx script/verify-scouter-stats.ts
 * Options:
 *   --fix          Remove rep_awards for scouters with zero scouting entries (resets their rep to 0)
 *   --delete-empty Remove scouter user accounts that have 0 entries and 0 rep awards (cleans up unused scouts)
 *   --dry          Show what would be done without making changes (use with --fix or --delete-empty)
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const doFix = args.includes("--fix");
  const deleteEmpty = args.includes("--delete-empty");
  const dryRun = args.includes("--dry");

  const pool = new Pool({ connectionString: url });

  try {
    // Get all scouters with their actual stats from scouting_entries
    const scoutersResult = await pool.query(`
      SELECT 
        u.id,
        u.display_name,
        COUNT(DISTINCT se.event_id) as events_scouted,
        COUNT(se.id) as total_entries,
        COALESCE(SUM(ra.amount), 0)::int as awards_rep
      FROM users u
      LEFT JOIN scouting_entries se ON se.scouter_id = u.id
      LEFT JOIN rep_awards ra ON ra.scouter_id = u.id
      WHERE u.role = 'scouter'
      GROUP BY u.id, u.display_name
    `);

    // Per-event entry counts
    const eventEntriesResult = await pool.query(`
      SELECT scouter_id, event_id, COUNT(*)::int as cnt
      FROM scouting_entries
      GROUP BY scouter_id, event_id
    `);
    const eventEntriesMap = new Map<string, number>();
    for (const row of eventEntriesResult.rows) {
      eventEntriesMap.set(`${row.scouter_id}-${row.event_id}`, parseInt(row.cnt, 10));
    }

    console.log("\n=== Scouter Stats Audit ===\n");

    const inconsistent: { id: number; name: string; reason: string }[] = [];
    const zeroEntryScoutersWithAwards: { id: number; name: string; awardsRep: number }[] = [];
    const emptyScouters: { id: number; name: string }[] = [];

    for (const row of scoutersResult.rows) {
      const id = row.id;
      const name = row.display_name;
      const eventsScouted = parseInt(row.events_scouted, 10) || 0;
      const totalEntries = parseInt(row.total_entries, 10) || 0;
      const awardsRep = parseInt(row.awards_rep, 10) || 0;
      const expectedRep = eventsScouted * 10 + totalEntries + awardsRep;

      if (totalEntries === 0 && eventsScouted > 0) {
        inconsistent.push({ id, name, reason: "events_scouted > 0 but total_entries = 0 (impossible)" });
      }
      if (totalEntries === 0 && awardsRep > 0) {
        zeroEntryScoutersWithAwards.push({ id, name, awardsRep });
      }
      if (totalEntries === 0 && awardsRep === 0) {
        emptyScouters.push({ id, name });
      }

      const status = totalEntries === 0 && eventsScouted === 0 ? " (no entries)" : "";
      console.log(`${name} (id=${id}): ${totalEntries} entries, ${eventsScouted} events, ${awardsRep} from awards → rep=${expectedRep}${status}`);
    }

    if (inconsistent.length > 0) {
      console.log("\n⚠ Inconsistencies found:");
      inconsistent.forEach((s) => console.log(`  - ${s.name} (id=${s.id}): ${s.reason}`));
    }

    if (zeroEntryScoutersWithAwards.length > 0) {
      console.log("\nScouters with 0 entries but have rep awards (rep from admin grants only):");
      zeroEntryScoutersWithAwards.forEach((s) => console.log(`  - ${s.name} (id=${s.id}): +${s.awardsRep} rep from awards`));
    }

    if (emptyScouters.length > 0) {
      console.log("\nEmpty scouters (0 entries, 0 awards — can be removed with --delete-empty):");
      emptyScouters.forEach((s) => console.log(`  - ${s.name} (id=${s.id})`));
    }

    // Delete empty scouter accounts (optional)
    if (deleteEmpty && emptyScouters.length > 0) {
      const ids = emptyScouters.map((s) => s.id);
      if (dryRun) {
        console.log("\n[DRY RUN] Would delete scouter user accounts:", ids);
      } else {
        await pool.query("UPDATE picklists SET created_by_id = NULL WHERE created_by_id = ANY($1::int[])", [ids]);
        const res = await pool.query("DELETE FROM users WHERE id = ANY($1::int[]) AND role = 'scouter' RETURNING id", [ids]);
        console.log(`\nDeleted ${res.rowCount} empty scouter account(s).`);
      }
    }

    // Fix: remove rep_awards for scouters with zero entries (optional)
    if (doFix && zeroEntryScoutersWithAwards.length > 0) {
      const ids = zeroEntryScoutersWithAwards.map((s) => s.id);
      if (dryRun) {
        console.log("\n[DRY RUN] Would delete rep_awards for scouter ids:", ids);
      } else {
        const res = await pool.query(
          "DELETE FROM rep_awards WHERE scouter_id = ANY($1::int[]) RETURNING id",
          [ids]
        );
        console.log(`\nDeleted ${res.rowCount} rep_award(s) for scouters with zero entries.`);
      }
    }

    console.log("\nDone.\n");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
