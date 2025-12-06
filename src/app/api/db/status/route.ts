import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/status
 * Check database status and migrations
 */
export async function GET() {
  try {
    // Test connection
    const [testResult] = await db.execute(sql`SELECT 1 as test`)
    
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    // Check organization_settings table columns
    const orgSettingsCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'organization_settings'
      ORDER BY ordinal_position
    `)

    // Check rss_feeds table columns
    const rssFeedsCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rss_feeds'
      ORDER BY ordinal_position
    `)

    // Check podcasts columns for org_id
    const podcastsCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'podcasts' AND column_name IN ('user_id', 'org_id')
      ORDER BY ordinal_position
    `)

    // Check avatars columns for org_id
    const avatarsCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'avatars' AND column_name IN ('user_id', 'org_id')
      ORDER BY ordinal_position
    `)

    // Count records
    const [podcastCount] = await db.execute(sql`SELECT COUNT(*) as count FROM podcasts`)
    const [avatarCount] = await db.execute(sql`SELECT COUNT(*) as count FROM avatars`)
    const [orgSettingsCount] = await db.execute(sql`SELECT COUNT(*) as count FROM organization_settings`)
    const [rssFeedsCount] = await db.execute(sql`SELECT COUNT(*) as count FROM rss_feeds`)

    return NextResponse.json({
      status: 'connected',
      tables: tables.rows?.map((r: { table_name: string }) => r.table_name) || [],
      migrations: {
        organization_settings: {
          exists: orgSettingsCols.rows && orgSettingsCols.rows.length > 0,
          columns: orgSettingsCols.rows || [],
          count: (podcastCount as { count: number })?.count || 0,
        },
        rss_feeds: {
          exists: rssFeedsCols.rows && rssFeedsCols.rows.length > 0,
          columns: rssFeedsCols.rows || [],
          count: (rssFeedsCount as { count: number })?.count || 0,
        },
        podcasts_org_columns: podcastsCols.rows || [],
        avatars_org_columns: avatarsCols.rows || [],
      },
      counts: {
        podcasts: (podcastCount as { count: number })?.count || 0,
        avatars: (avatarCount as { count: number })?.count || 0,
        organizationSettings: (orgSettingsCount as { count: number })?.count || 0,
        rssFeeds: (rssFeedsCount as { count: number })?.count || 0,
      },
    })
  } catch (error) {
    console.error('Database status error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

