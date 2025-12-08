/**
 * Next.js Instrumentation - runs on server startup
 * Used to auto-run database migrations
 */

export async function register() {
  // Only run on server startup (not on client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server starting - running database migrations...')
    
    try {
      // Import DB and run migrations directly
      const { db } = await import('@/lib/db')
      const { sql } = await import('drizzle-orm')
      
      // Test connection
      await db.execute(sql`SELECT 1 as test`)
      console.log('✅ Database connection successful')

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
      console.log('✅ avatars.image_variations column verified')

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
      console.log('✅ video_jobs.avatar_image_url column verified')

      // Add user_id column to podcasts if it doesn't exist
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'podcasts' AND column_name = 'user_id'
          ) THEN 
            ALTER TABLE podcasts ADD COLUMN user_id VARCHAR(255);
            CREATE INDEX IF NOT EXISTS podcasts_user_id_idx ON podcasts(user_id);
          END IF;
        END $$;
      `)
      console.log('✅ podcasts.user_id column verified')

      // Add user_id column to avatars if it doesn't exist
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'avatars' AND column_name = 'user_id'
          ) THEN 
            ALTER TABLE avatars ADD COLUMN user_id VARCHAR(255);
            CREATE INDEX IF NOT EXISTS avatars_user_id_idx ON avatars(user_id);
          END IF;
        END $$;
      `)
      console.log('✅ avatars.user_id column verified')

      // Assign all existing podcasts to Benjamin (first user) if they don't have a user_id
      await db.execute(sql`
        UPDATE podcasts SET user_id = 'user_36NDTS44K2a3AnOs0VcXsxWbNgn' WHERE user_id IS NULL
      `)
      console.log('✅ Assigned unowned podcasts to Benjamin')

      // Assign all existing non-default avatars to Benjamin if they don't have a user_id
      await db.execute(sql`
        UPDATE avatars SET user_id = 'user_36NDTS44K2a3AnOs0VcXsxWbNgn' 
        WHERE user_id IS NULL AND (is_default = false OR is_default IS NULL)
      `)
      console.log('✅ Assigned unowned avatars to Benjamin')

      // ============================================
      // ORGANIZATIONS FEATURE MIGRATIONS
      // ============================================

      // Create organization_settings table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS organization_settings (
          id SERIAL PRIMARY KEY,
          org_id VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          branding JSONB,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
      console.log('✅ organization_settings table verified')

      // Create rss_feeds table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rss_feeds (
          id SERIAL PRIMARY KEY,
          org_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          last_fetched_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS rss_feeds_org_id_idx ON rss_feeds(org_id)
      `)
      console.log('✅ rss_feeds table verified')

      // Add org_id column to podcasts if it doesn't exist
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'podcasts' AND column_name = 'org_id'
          ) THEN 
            ALTER TABLE podcasts ADD COLUMN org_id VARCHAR(255);
            CREATE INDEX IF NOT EXISTS podcasts_org_id_idx ON podcasts(org_id);
          END IF;
        END $$;
      `)
      console.log('✅ podcasts.org_id column verified')

      // Add org_id column to avatars if it doesn't exist
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'avatars' AND column_name = 'org_id'
          ) THEN 
            ALTER TABLE avatars ADD COLUMN org_id VARCHAR(255);
            CREATE INDEX IF NOT EXISTS avatars_org_id_idx ON avatars(org_id);
          END IF;
        END $$;
      `)
      console.log('✅ avatars.org_id column verified')

      // ============================================
      // AUDIO ARTICLES TABLE
      // ============================================
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS audio_articles (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          org_id VARCHAR(255),
          title VARCHAR(255) NOT NULL,
          original_text TEXT NOT NULL,
          summary TEXT NOT NULL,
          summary_duration VARCHAR(10),
          audio_url TEXT,
          voice VARCHAR(50) DEFAULT 'french',
          status VARCHAR(50) DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `)
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS audio_articles_user_id_idx ON audio_articles(user_id)
      `)
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS audio_articles_org_id_idx ON audio_articles(org_id)
      `)
      console.log('✅ audio_articles table verified')

      // ============================================
      // VIDEO SETTINGS COLUMN (intro/outro)
      // ============================================
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'organization_settings' AND column_name = 'video_settings'
          ) THEN 
            ALTER TABLE organization_settings ADD COLUMN video_settings JSONB;
          END IF;
        END $$;
      `)
      console.log('✅ organization_settings.video_settings column verified')

      console.log('✅ Database migrations completed successfully')
    } catch (error) {
      console.error('⚠️ Migration error (non-blocking):', error)
      // Don't block startup if migration fails
    }
  }
}
