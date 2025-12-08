CREATE TABLE IF NOT EXISTS "audio_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"org_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"original_text" text NOT NULL,
	"summary" text NOT NULL,
	"summary_duration" varchar(10),
	"audio_url" text,
	"voice" varchar(50) DEFAULT 'french',
	"status" varchar(50) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "video_settings" jsonb;