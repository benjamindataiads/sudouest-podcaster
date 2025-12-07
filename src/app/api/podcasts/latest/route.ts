import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, podcasts } from '@/lib/db'
import { desc, eq, isNull, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/podcasts/latest
 * Récupère les derniers podcasts de l'organisation ou de l'utilisateur
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    let latestPodcasts

    if (orgId) {
      // If org selected: show ONLY this org's podcasts (strict filtering)
      latestPodcasts = await db
        .select()
        .from(podcasts)
        .where(eq(podcasts.orgId, orgId))
        .orderBy(desc(podcasts.createdAt))
        .limit(50)
    } else {
      // No org selected: show user's personal podcasts (without any org)
      latestPodcasts = await db
        .select()
        .from(podcasts)
        .where(and(eq(podcasts.userId, userId), isNull(podcasts.orgId)))
        .orderBy(desc(podcasts.createdAt))
        .limit(50)
    }

    return NextResponse.json({ podcasts: latestPodcasts, orgId })
  } catch (error) {
    console.error('Error fetching podcasts:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération des podcasts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


