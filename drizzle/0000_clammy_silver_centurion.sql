CREATE TABLE IF NOT EXISTS "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"category" varchar(100),
	"published_at" timestamp NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"podcast_id" integer NOT NULL,
	"voice_id" varchar(100) NOT NULL,
	"file_url" text NOT NULL,
	"duration" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_jobs" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"podcast_id" integer,
	"script_chunks" jsonb,
	"voice_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"audio_url" text,
	"audio_chunks" jsonb,
	"fal_request_ids" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "avatars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"org_id" varchar(255),
	"name" varchar(100) NOT NULL,
	"voice_url" text NOT NULL,
	"image_url" text NOT NULL,
	"image_variations" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"branding" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "podcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"org_id" varchar(255),
	"title" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"current_step" integer DEFAULT 1,
	"avatar_id" integer,
	"selected_articles" jsonb,
	"script" jsonb,
	"script_edited_at" timestamp,
	"audio_chunks" jsonb,
	"video_urls" jsonb,
	"final_video_url" text,
	"thumbnail_url" text,
	"estimated_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rss_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"podcast_id" integer NOT NULL,
	"audio_file_id" integer NOT NULL,
	"avatar_id" varchar(100) NOT NULL,
	"file_url" text NOT NULL,
	"has_captions" boolean DEFAULT false,
	"duration" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_jobs" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"podcast_id" integer,
	"audio_chunk_index" integer NOT NULL,
	"audio_url" text NOT NULL,
	"text" text,
	"section" varchar(50),
	"avatar_image_url" text,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"video_url" text,
	"error" text,
	"fal_request_id" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audio_files" ADD CONSTRAINT "audio_files_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audio_jobs" ADD CONSTRAINT "audio_jobs_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_files" ADD CONSTRAINT "video_files_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_files" ADD CONSTRAINT "video_files_audio_file_id_audio_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."audio_files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "public"."podcasts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
