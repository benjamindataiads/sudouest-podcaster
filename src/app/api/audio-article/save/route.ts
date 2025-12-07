import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, audioArticles } from '@/lib/db'
import { eq, desc, and, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audio-article/save
 * Get all audio articles for the current user/org
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    console.log(`📋 Fetching audio articles for user ${userId}, org ${orgId}`)

    let articles
    if (orgId) {
      // Organization mode: get articles for this org
      articles = await db
        .select()
        .from(audioArticles)
        .where(eq(audioArticles.orgId, orgId))
        .orderBy(desc(audioArticles.createdAt))
    } else {
      // Personal mode: get articles for this user without org
      articles = await db
        .select()
        .from(audioArticles)
        .where(
          and(
            eq(audioArticles.userId, userId),
            isNull(audioArticles.orgId)
          )
        )
        .orderBy(desc(audioArticles.createdAt))
    }

    console.log(`✅ Found ${articles.length} audio articles`)

    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Error fetching audio articles:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    )
  }
}

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
    const { title, originalText, summary, summaryDuration, audioUrl, voice, voiceId } = body

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
        voice: voiceId || voice || 'Wise_Woman',
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

/**
 * DELETE /api/audio-article/save?id=123
 * Delete an audio article
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
    }

    const articleId = parseInt(id)

    // Check ownership before deleting
    const [article] = await db
      .select()
      .from(audioArticles)
      .where(eq(audioArticles.id, articleId))
      .limit(1)

    if (!article) {
      return NextResponse.json({ error: 'Article non trouvé' }, { status: 404 })
    }

    // Verify ownership
    if (orgId) {
      if (article.orgId !== orgId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      if (article.userId !== userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }

    console.log(`🗑️ Deleting audio article: ID ${articleId}`)

    await db.delete(audioArticles).where(eq(audioArticles.id, articleId))

    console.log(`✅ Audio article deleted: ID ${articleId}`)

    return NextResponse.json({
      message: 'Audio article supprimé',
    })
  } catch (error) {
    console.error('Error deleting audio article:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}

