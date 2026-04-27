ALTER TABLE "app_settings"
ADD COLUMN IF NOT EXISTS "globally_visible_event_ids" jsonb;
