-- Per-event allowlist: which scouters may access pit scouting.
-- Apply with drizzle-kit push, or run this SQL once if you manage schema manually.

CREATE TABLE IF NOT EXISTS "event_pit_scouting_access" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "scouter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_pit_scouting_access_event_scouter"
  ON "event_pit_scouting_access" ("event_id", "scouter_id");

CREATE INDEX IF NOT EXISTS "event_pit_scouting_access_event_id_idx"
  ON "event_pit_scouting_access" ("event_id");
