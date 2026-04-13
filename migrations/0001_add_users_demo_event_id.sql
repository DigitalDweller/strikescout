-- Safe, additive migration: demo accounts only. Does not drop or alter other columns.
-- Run once via: npm run db:add-demo-column
-- (Avoid `drizzle-kit push` if it proposes unrelated destructive changes.)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "demo_event_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_demo_event_id_events_id_fk'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_demo_event_id_events_id_fk"
      FOREIGN KEY ("demo_event_id") REFERENCES "public"."events"("id");
  END IF;
END $$;
