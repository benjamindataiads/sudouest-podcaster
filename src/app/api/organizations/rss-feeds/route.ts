import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, rssFeeds } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Default RSS feed for new organizations
const DEFAULT_RSS_FEED = {
  name: 'AFP France',
  url: 'https://flipboard.com/topic/fr-afp.rss',
}

/**
 * GET /api/organizations/rss-feeds
 * Get all RSS feeds for the current organization
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    const feeds = await db
      .select()
      .from(rssFeeds)
      .where(eq(rssFeeds.orgId, orgId))
      .orderBy(rssFeeds.createdAt)

    return NextResponse.json({ feeds })
  } catch (error) {
    console.error('Error fetching RSS feeds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/rss-feeds
 * Create a new RSS feed (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Only admins can create feeds
    if (orgRole !== 'org:admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, url } = body

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const [feed] = await db
      .insert(rssFeeds)
      .values({
        orgId,
        name,
        url,
        isActive: true,
      })
      .returning()

    console.log(`✅ Created RSS feed: ${name} for org ${orgId}`)
    return NextResponse.json({ feed })
  } catch (error) {
    console.error('Error creating RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to create RSS feed' },
      { status: 500 }
    )
  }
}

