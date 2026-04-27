ALTER TABLE "scouting_entries"
ADD COLUMN IF NOT EXISTS "died" boolean NOT NULL DEFAULT false;
