import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { podcasts, avatars } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/diagnostic
 * Shows all podcasts and avatars with their org/user assignments
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get ALL podcasts (no filtering)
    const allPodcasts = await db
      .select({
        id: podcasts.id,
        title: podcasts.title,
        status: podcasts.status,
        createdAt: podcasts.createdAt,
        orgId: podcasts.orgId,
        userId: podcasts.userId,
      })
      .from(podcasts)
      .orderBy(podcasts.createdAt)

    // Get ALL avatars (no filtering)
    const allAvatars = await db
      .select({
        id: avatars.id,
        name: avatars.name,
        isDefault: avatars.isDefault,
        createdAt: avatars.createdAt,
        orgId: avatars.orgId,
        userId: avatars.userId,
      })
      .from(avatars)
      .orderBy(avatars.createdAt)

    // Count by orgId
    const podcastsByOrg = allPodcasts.reduce((acc, p) => {
      const key = p.orgId || 'NULL'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const avatarsByOrg = allAvatars.reduce((acc, a) => {
      const key = a.orgId || 'NULL'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      currentUser: {
        userId,
        orgId,
      },
      summary: {
        totalPodcasts: allPodcasts.length,
        totalAvatars: allAvatars.length,
        podcastsByOrg,
        avatarsByOrg,
      },
      podcasts: allPodcasts.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        orgId: p.orgId || 'NULL',
        userId: p.userId || 'NULL',
        date: p.createdAt?.toLocaleDateString('fr-FR'),
      })),
      avatars: allAvatars.map(a => ({
        id: a.id,
        name: a.name,
        isDefault: a.isDefault,
        orgId: a.orgId || 'NULL',
        userId: a.userId || 'NULL',
      })),
      howToFix: {
        step1: 'Check podcastsByOrg and avatarsByOrg to see distribution',
        step2: 'If NULL count is high, use /api/db/fix-all to assign them to current org',
        step3: 'Make sure your current orgId matches what data is assigned to',
      },
    })
  } catch (error) {
    console.error('Error in diagnostic:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

