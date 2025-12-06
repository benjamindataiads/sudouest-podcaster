-- Add userId column to podcasts table for user ownership
ALTER TABLE "podcasts" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
-- Add userId column to avatars table for user ownership (null for default avatars)
ALTER TABLE "avatars" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
-- Assign all existing podcasts to Benjamin
UPDATE "podcasts" SET "user_id" = 'user_36NDTS44K2a3AnOs0VcXsxWbNgn';
--> statement-breakpoint
-- Assign all existing non-default avatars to Benjamin
UPDATE "avatars" SET "user_id" = 'user_36NDTS44K2a3AnOs0VcXsxWbNgn' WHERE "is_default" = false OR "is_default" IS NULL;
--> statement-breakpoint
-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS "podcasts_user_id_idx" ON "podcasts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avatars_user_id_idx" ON "avatars" ("user_id");

