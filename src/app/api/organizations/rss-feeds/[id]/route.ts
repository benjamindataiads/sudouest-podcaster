import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, rssFeeds } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/organizations/rss-feeds/[id]
 * Get a specific RSS feed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 })
    }

    const [feed] = await db
      .select()
      .from(rssFeeds)
      .where(and(eq(rssFeeds.id, id), eq(rssFeeds.orgId, orgId)))
      .limit(1)

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
    }

    return NextResponse.json({ feed })
  } catch (error) {
    console.error('Error fetching RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organizations/rss-feeds/[id]
 * Update an RSS feed (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId, orgRole } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    if (orgRole !== 'org:admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 })
    }

    // Check if feed exists and belongs to org
    const [existing] = await db
      .select()
      .from(rssFeeds)
      .where(and(eq(rssFeeds.id, id), eq(rssFeeds.orgId, orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, url, isActive } = body

    // Validate URL if provided
    if (url) {
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
      }
    }

    const updateData: Partial<typeof rssFeeds.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (name !== undefined) updateData.name = name
    if (url !== undefined) updateData.url = url
    if (isActive !== undefined) updateData.isActive = isActive

    const [feed] = await db
      .update(rssFeeds)
      .set(updateData)
      .where(eq(rssFeeds.id, id))
      .returning()

    console.log(`✅ Updated RSS feed: ${feed.name}`)
    return NextResponse.json({ feed })
  } catch (error) {
    console.error('Error updating RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to update RSS feed' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/rss-feeds/[id]
 * Delete an RSS feed (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId, orgRole } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    if (orgRole !== 'org:admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 })
    }

    // Check if feed exists and belongs to org
    const [existing] = await db
      .select()
      .from(rssFeeds)
      .where(and(eq(rssFeeds.id, id), eq(rssFeeds.orgId, orgId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
    }

    await db.delete(rssFeeds).where(eq(rssFeeds.id, id))

    console.log(`🗑️ Deleted RSS feed: ${existing.name}`)
    return NextResponse.json({ success: true, message: `Feed "${existing.name}" deleted` })
  } catch (error) {
    console.error('Error deleting RSS feed:', error)
    return NextResponse.json(
      { error: 'Failed to delete RSS feed' },
      { status: 500 }
    )
  }
}

