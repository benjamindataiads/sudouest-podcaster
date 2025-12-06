import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { db, podcasts, type NewPodcast } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/podcasts/save
 * Sauvegarde l'état actuel d'un podcast
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('Save podcast request:', { id: body.id, title: body.title, status: body.status, userId })
    
    const {
      id,
      title,
      date,
      status,
      currentStep,
      selectedArticles,
      script,
      audioChunks,
      videoUrls,
      finalVideoUrl,
      estimatedDuration,
      avatarId,
    } = body

    // Si ID existe, mettre à jour
    if (id) {
      // First verify ownership
      const [existing] = await db
        .select()
        .from(podcasts)
        .where(eq(podcasts.id, id))
        .limit(1)
      
      if (!existing) {
        return NextResponse.json({ error: 'Podcast non trouvé' }, { status: 404 })
      }
      
      // Check ownership (allow update if userId matches OR if legacy podcast without userId)
      if (existing.userId && existing.userId !== userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }

      const updateData: Partial<NewPodcast> = {
        updatedAt: new Date(),
      }
      
      // Claim legacy podcasts for current user
      if (!existing.userId) {
        updateData.userId = userId
      }
      
      if (title !== undefined) updateData.title = title
      if (date !== undefined) updateData.date = new Date(date)
      if (status !== undefined) {
        updateData.status = status
        if (status === 'completed') {
          updateData.completedAt = new Date()
        }
      }
      if (currentStep !== undefined) updateData.currentStep = currentStep
      if (selectedArticles !== undefined) updateData.selectedArticles = selectedArticles
      if (script !== undefined) updateData.script = script
      if (audioChunks !== undefined) updateData.audioChunks = audioChunks
      if (videoUrls !== undefined) updateData.videoUrls = videoUrls
      if (finalVideoUrl !== undefined) updateData.finalVideoUrl = finalVideoUrl
      if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration

      const [updated] = await db
        .update(podcasts)
        .set(updateData)
        .where(eq(podcasts.id, id))
        .returning()

      console.log('✅ Podcast updated:', updated.id)
      return NextResponse.json({ podcast: updated })
    }

    // Sinon, créer un nouveau podcast avec userId
    const insertData: NewPodcast = {
      userId, // Associate with current user
      title: title || `Podcast ${new Date().toLocaleDateString('fr-FR')}`,
      status: status || 'draft',
      currentStep: currentStep || 1,
      date: date ? new Date(date) : new Date(),
      selectedArticles: selectedArticles || undefined,
      script: script || undefined,
      audioChunks: audioChunks || undefined,
      videoUrls: videoUrls || undefined,
      finalVideoUrl: finalVideoUrl || undefined,
      estimatedDuration: estimatedDuration || undefined,
      avatarId: avatarId || undefined,
    }

    const [newPodcast] = await db
      .insert(podcasts)
      .values(insertData)
      .returning()

    console.log('✅ Podcast created:', newPodcast.id, 'for user:', userId)
    return NextResponse.json({ podcast: newPodcast })
  } catch (error) {
    console.error('❌ Error saving podcast:', error)
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    
    return NextResponse.json(
      {
        error: 'Erreur lors de la sauvegarde du podcast',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}


