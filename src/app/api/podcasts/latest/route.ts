import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, podcasts } from '@/lib/db'
import { desc, eq, or, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/podcasts/latest
 * Récupère les derniers podcasts de l'utilisateur connecté
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Get podcasts belonging to this user OR legacy podcasts without userId
    const latestPodcasts = await db
      .select()
      .from(podcasts)
      .where(or(eq(podcasts.userId, userId), isNull(podcasts.userId)))
      .orderBy(desc(podcasts.createdAt))
      .limit(50)

    return NextResponse.json({ podcasts: latestPodcasts })
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


