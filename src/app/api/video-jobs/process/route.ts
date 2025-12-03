import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, videoJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateVideo } from '@/lib/services/fal'
import { addOverlaysToVideo } from '@/lib/services/video-processor'
import path from 'path'

/**
 * POST /api/video-jobs/process
 * Traite un job vidéo spécifique (appelé en boucle par le client)
 */
export async function POST() {
  try {
    const { sql } = await import('drizzle-orm')
    
    // 1. Chercher un job en attente (queued) OU completed avec URL fal.ai non traitée
    const [jobToProcess] = await db
      .select()
      .from(videoJobs)
      .where(
        sql`${videoJobs.status} = 'queued' OR (${videoJobs.status} = 'completed' AND ${videoJobs.videoUrl} LIKE 'https://v3b.fal.media%')`
      )
      .limit(1)

    if (!jobToProcess) {
      return NextResponse.json({ 
        message: 'No jobs to process',
        hasMore: false 
      })
    }

    const needsFFmpegProcessing = jobToProcess.videoUrl?.startsWith('https://v3b.fal.media')
    console.log(`🎬 Processing job: ${jobToProcess.id} (needsFFmpeg: ${needsFFmpegProcessing})`)

    // 2. Marquer comme "generating" si pas déjà en processing
    if (jobToProcess.status !== 'generating') {
      await db
        .update(videoJobs)
        .set({ 
          status: 'generating',
          updatedAt: new Date() 
        })
        .where(eq(videoJobs.id, jobToProcess.id))
    }

    try {
      // 3. Obtenir l'URL de la vidéo brute
      let rawVideoUrl: string
      
      if (needsFFmpegProcessing) {
        console.log(`✅ Job already has video URL from fal.ai: ${jobToProcess.videoUrl}`)
        rawVideoUrl = jobToProcess.videoUrl!
      } else {
        // Générer nouvelle vidéo via fal.ai
        console.log(`🎬 Generating new video with fal.ai...`)
        const videoResult = await generateVideo({
          audioUrl: jobToProcess.audioUrl,
          avatarId: 'sudouest-default',
          avatarImageUrl: 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png',
        })
        rawVideoUrl = videoResult.videoUrl
        
        // Sauvegarder le request_id immédiatement
        await db
          .update(videoJobs)
          .set({
            falRequestId: videoResult.requestId,
            updatedAt: new Date(),
          })
          .where(eq(videoJobs.id, jobToProcess.id))
        
        console.log(`✅ Video generated with request_id: ${videoResult.requestId}`)
        console.log(`Video URL: ${rawVideoUrl}`)
      }


      // 4. Pour l'instant, utiliser directement l'URL de fal.ai (sans overlay)
      // Les overlays seront ajoutés uniquement dans la vidéo finale assemblée
      const publicUrl = rawVideoUrl

      // 6. Mettre à jour le job comme completed avec URL locale
      await db
        .update(videoJobs)
        .set({
          status: 'completed',
          videoUrl: publicUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobToProcess.id))

      console.log(`✅ Job ${jobToProcess.id} completed successfully with local URL: ${publicUrl}`)

      // Vérifier s'il y a d'autres jobs en attente
      const remainingJobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.status, 'queued'))
        .limit(1)

      return NextResponse.json({
        success: true,
        jobId: jobToProcess.id,
        videoUrl: publicUrl,
        hasMore: remainingJobs.length > 0,
      })

    } catch (error) {
      console.error(`❌ Job ${jobToProcess.id} failed:`, error)
      
      // Marquer comme failed
      await db
        .update(videoJobs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobToProcess.id))

      return NextResponse.json({
        success: false,
        jobId: jobToProcess.id,
        error: error instanceof Error ? error.message : String(error),
        hasMore: true, // Continuer avec les autres jobs
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing video jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du traitement des jobs',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

