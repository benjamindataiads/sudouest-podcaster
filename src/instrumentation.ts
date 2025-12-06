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

      console.log('✅ Database migrations completed successfully')
    } catch (error) {
      console.error('⚠️ Migration error (non-blocking):', error)
      // Don't block startup if migration fails
    }
  }
}
