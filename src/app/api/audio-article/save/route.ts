import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, audioArticles } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/audio-article/save
 * Save an audio article to the database
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { title, originalText, summary, summaryDuration, audioUrl, voice } = body

    if (!title || !originalText || !summary) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    console.log(`💾 Saving audio article: ${title} for user ${userId}, org ${orgId}`)

    const [saved] = await db
      .insert(audioArticles)
      .values({
        userId,
        orgId: orgId || undefined,
        title,
        originalText,
        summary,
        summaryDuration: summaryDuration || '60',
        audioUrl: audioUrl || undefined,
        voice: voice || 'french',
        status: audioUrl ? 'completed' : 'draft',
      })
      .returning()

    console.log(`✅ Audio article saved: ID ${saved.id}`)

    return NextResponse.json({
      id: saved.id,
      message: 'Audio article sauvegardé',
    })
  } catch (error) {
    console.error('Error saving audio article:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde' },
      { status: 500 }
    )
  }
}

