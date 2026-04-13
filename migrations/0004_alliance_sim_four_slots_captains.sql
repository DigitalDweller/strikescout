-- Alliance sim: optional third partner slot per event; captain labels per session.
-- Apply with drizzle-kit push, or run once if you manage schema manually.

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "alliance_sim_four_partner_slots" boolean DEFAULT false NOT NULL;

ALTER TABLE "alliance_sim_sessions"
  ADD COLUMN IF NOT EXISTS "captain_robots" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "alliance_sim_sessions"
  ALTER COLUMN "our_captain_slot" SET DEFAULT 1;

UPDATE "alliance_sim_sessions" SET "our_captain_slot" = 1 WHERE "our_captain_slot" IS NULL;
