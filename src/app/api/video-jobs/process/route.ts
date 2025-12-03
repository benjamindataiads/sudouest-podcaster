import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, videoJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { submitVideoWithWebhook } from '@/lib/services/fal'

/**
 * POST /api/video-jobs/process
 * Submits video job to fal.ai with webhooks (no polling)
 * Results will come via /api/webhooks/fal
 */
export async function POST() {
  try {
    // 1. Chercher un job en attente (queued)
    const [jobToProcess] = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.status, 'queued'))
      .limit(1)

    if (!jobToProcess) {
      return NextResponse.json({ 
        message: 'No jobs to process',
        hasMore: false 
      })
    }

    console.log(`🎬 Processing video job: ${jobToProcess.id}`)

    try {
      // 2. Submit to fal.ai with webhook (non-blocking)
      console.log(`📤 Submitting video to fal.ai with webhook...`)
      
      const { requestId, webhookUrl } = await submitVideoWithWebhook(
        jobToProcess.audioUrl,
        'https://dataiads-test1.fr/sudouest/avatarsudsouest.png'
      )

      console.log(`✅ Video submitted to fal.ai`)
      console.log(`  Request ID: ${requestId}`)
      console.log(`  Webhook URL: ${webhookUrl}`)

      // 3. Update job with request ID and mark as generating
      await db
        .update(videoJobs)
        .set({
          status: 'generating',
          falRequestId: requestId,
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobToProcess.id))

      // 4. Check for more queued jobs
      const remainingJobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.status, 'queued'))
        .limit(1)

      return NextResponse.json({
        success: true,
        jobId: jobToProcess.id,
        message: 'Video submitted, waiting for webhook callback',
        requestId,
        webhookUrl,
        hasMore: remainingJobs.length > 0,
      })

    } catch (error) {
      console.error(`❌ Job ${jobToProcess.id} failed:`, error)
      
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
        hasMore: true,
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

