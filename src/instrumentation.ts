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

      console.log('✅ Database migrations completed successfully')
    } catch (error) {
      console.error('⚠️ Migration error (non-blocking):', error)
      // Don't block startup if migration fails
    }
  }
}
