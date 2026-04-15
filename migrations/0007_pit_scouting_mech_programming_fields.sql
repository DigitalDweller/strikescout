-- Extend pit scouting sheet with mechanical + programming questions.

ALTER TABLE "pit_scouting_entries"
  ALTER COLUMN "has_auto" SET DEFAULT false;

ALTER TABLE "pit_scouting_entries"
  ALTER COLUMN "fits_under_trench" SET DEFAULT false;

ALTER TABLE "pit_scouting_entries"
  ADD COLUMN IF NOT EXISTS "robot_weight_lbs" integer,
  ADD COLUMN IF NOT EXISTS "uses_pathplanner" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "has_midfield_fuel_auto" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "new_auton_time_minutes" integer;

