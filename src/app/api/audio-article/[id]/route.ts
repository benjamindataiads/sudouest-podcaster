import { NextRequest, NextResponse } from 'next/server'
import { db, audioArticles } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audio-article/[id]
 * Get a single audio article by ID (public endpoint for sharing)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const [article] = await db
      .select({
        id: audioArticles.id,
        title: audioArticles.title,
        summary: audioArticles.summary,
        audioUrl: audioArticles.audioUrl,
        voice: audioArticles.voice,
        createdAt: audioArticles.createdAt,
        status: audioArticles.status,
      })
      .from(audioArticles)
      .where(eq(audioArticles.id, id))
      .limit(1)

    if (!article) {
      return NextResponse.json({ error: 'Article non trouvé' }, { status: 404 })
    }

    // Only return completed articles publicly
    if (article.status !== 'completed' || !article.audioUrl) {
      return NextResponse.json({ error: 'Article non disponible' }, { status: 404 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Error fetching audio article:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    )
  }
}

