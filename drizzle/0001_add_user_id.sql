-- Add userId column to podcasts table for user ownership
ALTER TABLE "podcasts" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
-- Add userId column to avatars table for user ownership (null for default avatars)
ALTER TABLE "avatars" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint
-- Migrate all existing podcasts to Benjamin (first user)
UPDATE "podcasts" SET "user_id" = 'user_2xnrWq4NdD50f3l5CWKXWDOKItu' WHERE "user_id" IS NULL;
--> statement-breakpoint
-- Migrate all existing non-default avatars to Benjamin
UPDATE "avatars" SET "user_id" = 'user_2xnrWq4NdD50f3l5CWKXWDOKItu' WHERE "user_id" IS NULL AND "is_default" = false;
--> statement-breakpoint
-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS "podcasts_user_id_idx" ON "podcasts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avatars_user_id_idx" ON "avatars" ("user_id");

