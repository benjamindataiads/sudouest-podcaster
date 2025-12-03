import { NextResponse } from 'next/server'
import { db, podcasts } from '@/lib/db'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/podcasts/latest
 * Récupère les derniers podcasts
 */
export async function GET() {
  try {
    const latestPodcasts = await db
      .select()
      .from(podcasts)
      .orderBy(desc(podcasts.createdAt))
      .limit(10)

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


