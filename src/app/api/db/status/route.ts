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
    await db.execute(sql`SELECT 1 as test`)
    
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
    const podcastCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM podcasts`)
    const avatarCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM avatars`)
    const orgSettingsCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM organization_settings`)
    const rssFeedsCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM rss_feeds`)

    // Convert results to arrays (drizzle returns array-like objects)
    const tablesArr = Array.from(tables) as Array<{ table_name: string }>
    const orgSettingsColsArr = Array.from(orgSettingsCols) as Array<{ column_name: string; data_type: string }>
    const rssFeedsColsArr = Array.from(rssFeedsCols) as Array<{ column_name: string; data_type: string }>
    const podcastsColsArr = Array.from(podcastsCols) as Array<{ column_name: string; data_type: string }>
    const avatarsColsArr = Array.from(avatarsCols) as Array<{ column_name: string; data_type: string }>

    return NextResponse.json({
      status: 'connected',
      tables: tablesArr.map(r => r.table_name),
      migrations: {
        organization_settings: {
          exists: orgSettingsColsArr.length > 0,
          columns: orgSettingsColsArr,
        },
        rss_feeds: {
          exists: rssFeedsColsArr.length > 0,
          columns: rssFeedsColsArr,
        },
        podcasts_org_columns: podcastsColsArr,
        avatars_org_columns: avatarsColsArr,
      },
      counts: {
        podcasts: (Array.from(podcastCount)[0] as { count: number })?.count || 0,
        avatars: (Array.from(avatarCount)[0] as { count: number })?.count || 0,
        organizationSettings: (Array.from(orgSettingsCount)[0] as { count: number })?.count || 0,
        rssFeeds: (Array.from(rssFeedsCount)[0] as { count: number })?.count || 0,
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

