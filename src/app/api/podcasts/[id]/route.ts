import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { db, podcasts, audioFiles, videoFiles, avatars } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/podcasts/[id]
 * Récupère un podcast spécifique avec son avatar
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const podcastId = parseInt(params.id)

    if (isNaN(podcastId)) {
      return NextResponse.json(
        { error: 'ID invalide' },
        { status: 400 }
      )
    }

    // Fetch podcast with org filter
    let podcast
    if (orgId) {
      // Org mode: podcast must belong to this org
      const [result] = await db
        .select()
        .from(podcasts)
        .where(and(eq(podcasts.id, podcastId), eq(podcasts.orgId, orgId)))
        .limit(1)
      podcast = result
    } else {
      // Personal mode: podcast must belong to this user and have no org
      const [result] = await db
        .select()
        .from(podcasts)
        .where(and(eq(podcasts.id, podcastId), eq(podcasts.userId, userId)))
        .limit(1)
      podcast = result
    }

    if (!podcast) {
      return NextResponse.json(
        { error: 'Podcast non trouvé' },
        { status: 404 }
      )
    }

    // Load avatar if avatarId exists
    let avatar = null
    if (podcast.avatarId) {
      const [avatarData] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.id, podcast.avatarId))
        .limit(1)
      avatar = avatarData
    }

    // If no avatar, try to get default avatar
    if (!avatar) {
      const [defaultAvatar] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.isDefault, true))
        .limit(1)
      avatar = defaultAvatar
    }

    return NextResponse.json({ podcast, avatar })
  } catch (error) {
    console.error('Error fetching podcast:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération du podcast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/podcasts/[id]
 * Supprime un podcast et ses fichiers associés
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const podcastId = parseInt(params.id)
    console.log('Delete podcast request:', podcastId, 'by user:', userId, 'org:', orgId)

    if (isNaN(podcastId)) {
      return NextResponse.json(
        { error: 'ID invalide' },
        { status: 400 }
      )
    }

    // Verify podcast exists AND belongs to this org/user
    let existingPodcast
    if (orgId) {
      const [result] = await db
        .select()
        .from(podcasts)
        .where(and(eq(podcasts.id, podcastId), eq(podcasts.orgId, orgId)))
        .limit(1)
      existingPodcast = result
    } else {
      const [result] = await db
        .select()
        .from(podcasts)
        .where(and(eq(podcasts.id, podcastId), eq(podcasts.userId, userId)))
        .limit(1)
      existingPodcast = result
    }

    if (!existingPodcast) {
      return NextResponse.json(
        { error: 'Podcast non trouvé' },
        { status: 404 }
      )
    }

    // Supprimer les jobs vidéo associés (ajouté pour éviter contrainte FK)
    const { videoJobs, audioJobs } = await import('@/lib/db')
    await db
      .delete(videoJobs)
      .where(eq(videoJobs.podcastId, podcastId))
    
    // Supprimer les jobs audio associés
    await db
      .delete(audioJobs)
      .where(eq(audioJobs.podcastId, podcastId))

    // Supprimer les fichiers vidéo associés
    await db
      .delete(videoFiles)
      .where(eq(videoFiles.podcastId, podcastId))

    // Supprimer les fichiers audio associés
    await db
      .delete(audioFiles)
      .where(eq(audioFiles.podcastId, podcastId))

    // Supprimer le podcast
    await db
      .delete(podcasts)
      .where(eq(podcasts.id, podcastId))

    console.log('✅ Podcast deleted:', podcastId)
    
    return NextResponse.json({ 
      success: true,
      message: 'Podcast supprimé avec succès' 
    })
  } catch (error) {
    console.error('❌ Error deleting podcast:', error)
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    
    return NextResponse.json(
      {
        error: 'Erreur lors de la suppression du podcast',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}


