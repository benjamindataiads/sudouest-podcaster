import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, audioJobs, podcasts, avatars } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { submitAudioWithWebhooks } from '@/lib/services/fal'
import { ScriptChunk } from '@/types'

/**
 * POST /api/audio-jobs/process
 * Submits audio job to fal.ai with webhooks (no polling)
 * Results will come via /api/webhooks/fal
 */
export async function POST() {
  try {
    // 1. Chercher un job en attente
    const [queuedJob] = await db
      .select()
      .from(audioJobs)
      .where(eq(audioJobs.status, 'queued'))
      .limit(1)

    if (!queuedJob) {
      return NextResponse.json({ 
        message: 'No queued audio jobs',
        hasMore: false 
      })
    }

    console.log(`🎤 Processing audio job: ${queuedJob.id}`)

    const scriptChunks = (queuedJob.scriptChunks || []) as ScriptChunk[]
    
    if (scriptChunks.length === 0) {
      await db
        .update(audioJobs)
        .set({
          status: 'failed',
          error: 'No script chunks provided',
          updatedAt: new Date(),
        })
        .where(eq(audioJobs.id, queuedJob.id))
      
      return NextResponse.json({
        success: false,
        jobId: queuedJob.id,
        error: 'No script chunks provided',
      }, { status: 400 })
    }

    // Get avatar voice URL from podcast
    let voiceUrl: string | undefined
    if (queuedJob.podcastId) {
      const [podcast] = await db
        .select()
        .from(podcasts)
        .where(eq(podcasts.id, queuedJob.podcastId))
        .limit(1)
      
      if (podcast?.avatarId) {
        const [avatar] = await db
          .select()
          .from(avatars)
          .where(eq(avatars.id, podcast.avatarId))
          .limit(1)
        
        if (avatar) {
          voiceUrl = avatar.voiceUrl
          console.log(`🎤 Using avatar voice: ${avatar.name} (${voiceUrl})`)
        }
      }
    }

    try {
      // 2. Submit to fal.ai with webhooks (non-blocking)
      console.log(`📤 Submitting ${scriptChunks.length} audio chunks with webhooks...`)
      
      const { requestIds, webhookUrl } = await submitAudioWithWebhooks(scriptChunks, voiceUrl)

      console.log(`✅ All ${requestIds.length} chunks submitted to fal.ai`)
      console.log(`📥 Webhook URL: ${webhookUrl}`)

      // 3. Update job with request IDs and mark as generating
      await db
        .update(audioJobs)
        .set({
          status: 'generating',
          falRequestIds: requestIds,
          updatedAt: new Date(),
        })
        .where(eq(audioJobs.id, queuedJob.id))

      // 4. Check for more jobs
      const remainingJobs = await db
        .select()
        .from(audioJobs)
        .where(eq(audioJobs.status, 'queued'))
        .limit(1)

      return NextResponse.json({
        success: true,
        jobId: queuedJob.id,
        message: `Submitted ${requestIds.length} audio chunks, waiting for webhook callbacks`,
        requestIds,
        webhookUrl,
        hasMore: remainingJobs.length > 0,
      })

    } catch (error) {
      console.error(`❌ Audio job ${queuedJob.id} failed:`, error)
      
      await db
        .update(audioJobs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(audioJobs.id, queuedJob.id))

      return NextResponse.json({
        success: false,
        jobId: queuedJob.id,
        error: error instanceof Error ? error.message : String(error),
        hasMore: true,
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing audio job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du traitement du job audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

