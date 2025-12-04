import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { generateVideo, generateCaptions } from '@/lib/services/fal'
import { addOverlaysToVideo } from '@/lib/services/video-processor'
import { db, videoFiles, podcasts, audioFiles, avatars } from '@/lib/db'
import { eq } from 'drizzle-orm'
import path from 'path'

/**
 * POST /api/video/generate
 * Génère une vidéo avec lip-sync, logo et sous-titres
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      podcastId, 
      audioFileId, 
      audioUrl, 
      avatarId, 
      avatarImageUrl: providedImageUrl,  // URL d'image fournie directement
      withCaptions = true 
    } = body

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'URL audio requis' },
        { status: 400 }
      )
    }

    // Récupérer l'URL de l'image de l'avatar
    let finalAvatarImageUrl = providedImageUrl
    
    // Si pas d'URL fournie mais un avatarId, chercher dans la DB
    if (!finalAvatarImageUrl && avatarId) {
      console.log(`🔍 Looking up avatar image for ID: ${avatarId}`)
      
      // Si avatarId est un nombre, chercher dans la table avatars
      const avatarIdNum = parseInt(avatarId)
      if (!isNaN(avatarIdNum)) {
        const [avatar] = await db
          .select()
          .from(avatars)
          .where(eq(avatars.id, avatarIdNum))
          .limit(1)
        
        if (avatar) {
          finalAvatarImageUrl = avatar.imageUrl
          console.log(`✅ Found avatar: ${avatar.name} => ${finalAvatarImageUrl}`)
        }
      }
    }
    
    console.log(`🎬 Final avatar image URL: ${finalAvatarImageUrl || 'will use default'}`)

    // 1. Générer la vidéo avec lip-sync
    console.log('Generating video with lip-sync...')
    const videoResult = await generateVideo({
      audioUrl,
      avatarId,
      avatarImageUrl: finalAvatarImageUrl,  // Passer l'URL de l'image
    })

    console.log(`✅ Video generated: ${videoResult.videoUrl}`)
    console.log(`Request ID: ${videoResult.requestId}`)

    // 2. Retourner directement l'URL de fal.ai (sans overlays)
    // Les overlays seront ajoutés uniquement dans la vidéo finale assemblée si besoin
    
    // 3. Sauvegarder dans la DB si IDs fournis
    if (podcastId && audioFileId) {
      const [videoFile] = await db.insert(videoFiles).values({
        podcastId,
        audioFileId,
        avatarId,
        fileUrl: videoResult.videoUrl,
        hasCaptions: false,
        duration: videoResult.duration,
        metadata: { 
          generatedAt: new Date().toISOString(),
          falRequestId: videoResult.requestId,
        },
      }).returning()

      // Mettre à jour le statut du podcast
      await db.update(podcasts)
        .set({ 
          status: 'video_generated',
          updatedAt: new Date(),
        })
        .where(eq(podcasts.id, podcastId))

      return NextResponse.json({
        videoFile,
        videoUrl: videoFile.fileUrl,
        duration: videoResult.duration,
        requestId: videoResult.requestId,
      })
    }

    return NextResponse.json({
      videoUrl: videoResult.videoUrl,
      duration: videoResult.duration,
      requestId: videoResult.requestId,
    })
  } catch (error) {
    console.error('❌ Error generating video:', error)
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération de la vidéo',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

