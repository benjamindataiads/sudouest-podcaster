import { NextResponse } from 'next/server'
import { db, podcasts, articles, audioJobs, videoJobs } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/migrate
 * Creates database tables if they don't exist
 * This is a simple migration endpoint for Railway deployment
 */
export async function GET() {
  try {
    // Test database connection first
    const result = await db.execute(sql`SELECT 1 as test`)
    console.log('✅ Database connection successful')

    // Create tables using raw SQL if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        content TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        image_url TEXT,
        category VARCHAR(100),
        published_at TIMESTAMP NOT NULL,
        scraped_at TIMESTAMP DEFAULT NOW() NOT NULL,
        metadata JSONB
      )
    `)
    console.log('✅ articles table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS podcasts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        date TIMESTAMP DEFAULT NOW() NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        current_step INTEGER DEFAULT 1,
        selected_articles JSONB,
        script JSONB,
        script_edited_at TIMESTAMP,
        audio_chunks JSONB,
        video_urls JSONB,
        final_video_url TEXT,
        thumbnail_url TEXT,
        estimated_duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP
      )
    `)
    console.log('✅ podcasts table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audio_files (
        id SERIAL PRIMARY KEY,
        podcast_id INTEGER REFERENCES podcasts(id) NOT NULL,
        voice_id VARCHAR(100) NOT NULL,
        file_url TEXT NOT NULL,
        duration INTEGER,
        generated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        metadata JSONB
      )
    `)
    console.log('✅ audio_files table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS video_files (
        id SERIAL PRIMARY KEY,
        podcast_id INTEGER REFERENCES podcasts(id) NOT NULL,
        audio_file_id INTEGER REFERENCES audio_files(id) NOT NULL,
        avatar_id VARCHAR(100) NOT NULL,
        file_url TEXT NOT NULL,
        has_captions BOOLEAN DEFAULT FALSE,
        duration INTEGER,
        generated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        metadata JSONB
      )
    `)
    console.log('✅ video_files table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audio_jobs (
        id VARCHAR(100) PRIMARY KEY,
        podcast_id INTEGER REFERENCES podcasts(id),
        script_chunks JSONB,
        voice_id TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        audio_url TEXT,
        audio_chunks JSONB,
        fal_request_ids JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP
      )
    `)
    console.log('✅ audio_jobs table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS video_jobs (
        id VARCHAR(100) PRIMARY KEY,
        podcast_id INTEGER REFERENCES podcasts(id),
        audio_chunk_index INTEGER NOT NULL,
        audio_url TEXT NOT NULL,
        text TEXT,
        section VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        video_url TEXT,
        error TEXT,
        fal_request_id VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP
      )
    `)
    console.log('✅ video_jobs table created/verified')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `)
    console.log('✅ categories table created/verified')

    // Create avatars table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS avatars (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        voice_url TEXT NOT NULL,
        image_url TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `)
    console.log('✅ avatars table created/verified')

    // Add avatar_id column to podcasts if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'podcasts' AND column_name = 'avatar_id'
        ) THEN 
          ALTER TABLE podcasts ADD COLUMN avatar_id INTEGER;
        END IF;
      END $$;
    `)
    console.log('✅ podcasts.avatar_id column added/verified')

    // Change voice_id from VARCHAR(100) to TEXT to support full URLs
    await db.execute(sql`
      DO $$ 
      BEGIN 
        ALTER TABLE audio_jobs ALTER COLUMN voice_id TYPE TEXT;
      EXCEPTION
        WHEN others THEN 
          RAISE NOTICE 'voice_id column type change skipped (might already be TEXT)';
      END $$;
    `)
    console.log('✅ audio_jobs.voice_id changed to TEXT')

    // Add image_variations column to avatars if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'avatars' AND column_name = 'image_variations'
        ) THEN 
          ALTER TABLE avatars ADD COLUMN image_variations JSONB;
        END IF;
      END $$;
    `)
    console.log('✅ avatars.image_variations column added/verified')

    // Add avatar_image_url column to video_jobs if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'video_jobs' AND column_name = 'avatar_image_url'
        ) THEN 
          ALTER TABLE video_jobs ADD COLUMN avatar_image_url TEXT;
        END IF;
      END $$;
    `)
    console.log('✅ video_jobs.avatar_image_url column added/verified')

    return NextResponse.json({
      success: true,
      message: 'All database tables created/verified successfully',
      tables: ['articles', 'podcasts', 'audio_files', 'video_files', 'audio_jobs', 'video_jobs', 'categories', 'avatars']
    })
  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database migration failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

