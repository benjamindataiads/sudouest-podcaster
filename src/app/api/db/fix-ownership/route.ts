import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, podcasts, avatars } from '@/lib/db'
import { ne, isNull, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * POST /api/db/fix-ownership
 * Assigns ALL podcasts and non-default avatars to the current user.
 * Use this to fix ownership after migration.
 */
export async function POST() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    console.log(`🔧 Fixing ownership - assigning all content to user: ${userId}`)

    // Update ALL podcasts to current user
    const podcastResult = await db
      .update(podcasts)
      .set({ userId })
      .returning()

    console.log(`✅ Updated ${podcastResult.length} podcasts`)

    // Update all non-default avatars to current user
    const avatarResult = await db
      .update(avatars)
      .set({ userId })
      .where(or(
        ne(avatars.isDefault, true),
        isNull(avatars.isDefault)
      ))
      .returning()

    console.log(`✅ Updated ${avatarResult.length} avatars`)

    return NextResponse.json({
      success: true,
      userId,
      podcastsUpdated: podcastResult.length,
      avatarsUpdated: avatarResult.length,
      message: `All content assigned to user ${userId}`,
    })
  } catch (error) {
    console.error('❌ Error fixing ownership:', error)
    return NextResponse.json(
      { error: 'Failed to fix ownership', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/db/fix-ownership
 * Shows current user ID and content counts
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const allPodcasts = await db.select().from(podcasts)
    const allAvatars = await db.select().from(avatars)

    return NextResponse.json({
      currentUserId: userId,
      podcasts: {
        total: allPodcasts.length,
        byUser: allPodcasts.reduce((acc, p) => {
          const key = p.userId || 'null'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
      avatars: {
        total: allAvatars.length,
        byUser: allAvatars.reduce((acc, a) => {
          const key = a.userId || 'null'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

