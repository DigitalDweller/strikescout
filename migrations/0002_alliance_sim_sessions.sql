-- Alliance selection simulator sessions (serpentine draft state per event).
-- Apply with drizzle-kit push, or run this SQL once if you manage schema manually.

CREATE TABLE IF NOT EXISTS "alliance_sim_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "name" text DEFAULT 'Alliance sim' NOT NULL,
  "our_captain_slot" integer NOT NULL,
  "picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alliance_sim_sessions_event_id_events_id_fk'
  ) THEN
    ALTER TABLE "alliance_sim_sessions"
      ADD CONSTRAINT "alliance_sim_sessions_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alliance_sim_sessions_created_by_id_users_id_fk'
  ) THEN
    ALTER TABLE "alliance_sim_sessions"
      ADD CONSTRAINT "alliance_sim_sessions_created_by_id_users_id_fk"
      FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "alliance_sim_sessions_event_id_idx" ON "alliance_sim_sessions" ("event_id");
