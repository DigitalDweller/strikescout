-- Pit scouting (one logical sheet per team per event; app replaces on resubmit).
-- Apply with drizzle-kit push, or run this SQL once if you manage schema manually.

CREATE TABLE IF NOT EXISTS "pit_scouting_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "scouter_id" integer NOT NULL,
  "event_id" integer NOT NULL,
  "team_id" integer NOT NULL,
  "robot_hero_image" text,
  "robot_extra_image_1" text,
  "robot_extra_image_2" text,
  "robot_extra_image_3" text,
  "robot_extra_image_4" text,
  "drivetrain_type" text DEFAULT 'other' NOT NULL,
  "has_auto" boolean NOT NULL,
  "fits_under_trench" boolean NOT NULL,
  "auto_description" text,
  "pit_climb_notes" text,
  "hopper_capacity" integer DEFAULT 0 NOT NULL,
  "hopper_capacity_over_100" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pit_scouting_entries_event_id_idx" ON "pit_scouting_entries" ("event_id");
CREATE INDEX IF NOT EXISTS "pit_scouting_entries_team_id_idx" ON "pit_scouting_entries" ("team_id");
