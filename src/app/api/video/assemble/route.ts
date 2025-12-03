import { NextRequest, NextResponse } from 'next/server'
import { concatenateVideos } from '@/lib/services/video-processor'
import { addOverlaysToVideo } from '@/lib/services/video-processor'
import path from 'path'

/**
 * POST /api/video/assemble
 * Assemble plusieurs vidéos en une seule avec ffmpeg
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoUrls, withCaptions = false, podcastId } = body

    console.log('📦 Assemble request received:', { videoUrlsCount: videoUrls?.length, withCaptions, podcastId })

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'Liste de vidéos requise' },
        { status: 400 }
      )
    }

    console.log(`Assembling ${videoUrls.length} video chunks:`)
    videoUrls.forEach((url, idx) => console.log(`  ${idx + 1}. ${url}`))

    // Concaténer les vidéos (sans overlays pour éviter les problèmes de sync)
    const concatenatedPath = await concatenateVideos(videoUrls)
    
    console.log('✅ Videos concatenated successfully:', concatenatedPath)

    // Retourner l'URL relative
    const relativeUrl = concatenatedPath.replace(path.join(process.cwd(), 'public'), '')

    // Sauvegarder dans le podcast si podcastId fourni
    if (podcastId) {
      const { db, podcasts } = await import('@/lib/db')
      const { eq } = await import('drizzle-orm')
      
      await db.update(podcasts)
        .set({
          finalVideoUrl: relativeUrl,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(podcasts.id, podcastId))
      
      console.log(`✅ Podcast ${podcastId} updated with final video: ${relativeUrl}`)
    }

    return NextResponse.json({
      videoUrl: relativeUrl,
      chunksAssembled: videoUrls.length,
    })
  } catch (error) {
    console.error('❌ Error assembling videos:', error)
    
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'assemblage des vidéos',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

