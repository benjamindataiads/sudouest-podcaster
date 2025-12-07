import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { podcasts, avatars } from '@/lib/db/schema'
import { sql, eq, isNull, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/fix-all
 * Preview what would be fixed
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Count unassigned podcasts
    const unassignedPodcasts = await db
      .select({ id: podcasts.id, title: podcasts.title })
      .from(podcasts)
      .where(isNull(podcasts.orgId))

    // Count unassigned avatars (non-default)
    const unassignedAvatars = await db
      .select({ id: avatars.id, name: avatars.name })
      .from(avatars)
      .where(isNull(avatars.orgId))

    return NextResponse.json({
      currentOrg: orgId,
      preview: {
        podcastsToFix: unassignedPodcasts.length,
        avatarsToFix: unassignedAvatars.length,
        podcasts: unassignedPodcasts,
        avatars: unassignedAvatars,
      },
      hint: orgId 
        ? 'POST to this endpoint to assign all unassigned content to your current org'
        : '⚠️ You need to select an organization first!',
    })
  } catch (error) {
    console.error('Error in fix-all preview:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/db/fix-all
 * Assign all unassigned podcasts/avatars to the current organization
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ 
        error: 'No organization selected',
        hint: 'Select an organization in the sidebar before running this fix',
      }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const targetOrgId = body.targetOrgId || orgId

    // Fix podcasts
    const fixedPodcasts = await db
      .update(podcasts)
      .set({ 
        orgId: targetOrgId,
        userId: userId, // Also set userId if missing
      })
      .where(isNull(podcasts.orgId))
      .returning({ id: podcasts.id, title: podcasts.title })

    // Fix avatars (non-default only)
    const fixedAvatars = await db
      .update(avatars)
      .set({ 
        orgId: targetOrgId,
        userId: userId,
      })
      .where(isNull(avatars.orgId))
      .returning({ id: avatars.id, name: avatars.name })

    return NextResponse.json({
      success: true,
      targetOrgId,
      fixed: {
        podcasts: fixedPodcasts.length,
        avatars: fixedAvatars.length,
        podcastDetails: fixedPodcasts,
        avatarDetails: fixedAvatars,
      },
    })
  } catch (error) {
    console.error('Error in fix-all:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

