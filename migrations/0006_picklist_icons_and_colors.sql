-- Picklists: optional icon + color metadata for UI.
-- Apply with drizzle-kit push, or run this SQL once if you manage schema manually.

ALTER TABLE "picklists"
  ADD COLUMN IF NOT EXISTS "icon" text;

ALTER TABLE "picklists"
  ADD COLUMN IF NOT EXISTS "color" text;
