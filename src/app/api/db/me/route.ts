import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { podcasts, avatars } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/me
 * Check current user's ID and associated data
 */
export async function GET() {
  try {
    const { userId, orgId, orgRole, sessionId } = await auth()

    if (!userId) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        hint: 'Please sign in first'
      }, { status: 401 })
    }

    // Count user's podcasts
    const userPodcasts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(podcasts)
      .where(eq(podcasts.userId, userId))

    // Count user's avatars
    const userAvatars = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(avatars)
      .where(eq(avatars.userId, userId))

    // Count all podcasts (to compare)
    const allPodcasts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(podcasts)

    // Count all avatars
    const allAvatars = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(avatars)

    // Check if expected user ID exists
    const expectedUserId = 'user_36NDTS44K2a3AnOs0VcXsxWbNgn'
    const expectedUserPodcasts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(podcasts)
      .where(eq(podcasts.userId, expectedUserId))

    return NextResponse.json({
      currentUser: {
        userId,
        orgId: orgId || null,
        orgRole: orgRole || null,
        sessionId,
        isExpectedUser: userId === expectedUserId,
      },
      yourData: {
        podcasts: userPodcasts[0]?.count || 0,
        avatars: userAvatars[0]?.count || 0,
      },
      totalData: {
        podcasts: allPodcasts[0]?.count || 0,
        avatars: allAvatars[0]?.count || 0,
      },
      expectedUserData: {
        expectedUserId,
        podcasts: expectedUserPodcasts[0]?.count || 0,
      },
      clerkOrganizations: {
        enabled: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        hint: orgId ? 'Organization selected' : 'No organization - create one in Clerk Dashboard or via OrganizationSwitcher',
      },
    })
  } catch (error) {
    console.error('Error checking user data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

