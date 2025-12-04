import { NextRequest, NextResponse } from 'next/server'
import { db, videoJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as fal from '@fal-ai/serverless-client'
import { uploadVideoToBucket, isBucketConfigured } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'

// Configure fal
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

/**
 * POST /api/video-jobs/recover
 * Recover stuck video jobs by fetching results from fal.ai
 */
export async function POST(request: NextRequest) {
  try {
    // Find jobs that are stuck in "generating" with a falRequestId
    const stuckJobs = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.status, 'generating'))

    const jobsWithRequestId = stuckJobs.filter(job => job.falRequestId)

    if (jobsWithRequestId.length === 0) {
      return NextResponse.json({
        message: 'No stuck jobs with request IDs found',
        recovered: 0,
      })
    }

    console.log(`🔧 Found ${jobsWithRequestId.length} stuck jobs to recover`)

    const results = []

    for (const job of jobsWithRequestId) {
      try {
        console.log(`📥 Fetching result for job ${job.id} (${job.falRequestId})`)

        // Try to get the result from fal.ai
    const result = await fal.queue.result('fal-ai/kling-video/v1/standard/ai-avatar', {
          requestId: job.falRequestId!,
        }) as { video?: { url?: string } }

        if (result?.video?.url) {
          let finalVideoUrl = result.video.url

          // Upload to bucket if configured
          if (isBucketConfigured()) {
            try {
              console.log(`📤 Uploading recovered video to bucket...`)
              finalVideoUrl = await uploadVideoToBucket(result.video.url, job.id)
              console.log(`✅ Uploaded to bucket: ${finalVideoUrl}`)
            } catch (uploadError) {
              console.error(`⚠️ Bucket upload failed:`, uploadError)
            }
          }

          // Update job as completed
          await db
      .update(videoJobs)
      .set({
        status: 'completed',
              videoUrl: finalVideoUrl,
              error: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
            .where(eq(videoJobs.id, job.id))

          results.push({
            jobId: job.id,
            status: 'recovered',
            videoUrl: finalVideoUrl,
          })

          console.log(`✅ Job ${job.id} recovered: ${finalVideoUrl}`)
        } else {
          results.push({
            jobId: job.id,
            status: 'no_result',
            error: 'No video URL in result',
          })
        }
      } catch (error) {
        console.error(`❌ Failed to recover job ${job.id}:`, error)
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Check if the job is still processing or failed
        if (errorMessage.includes('IN_QUEUE') || errorMessage.includes('IN_PROGRESS')) {
          results.push({
            jobId: job.id,
            status: 'still_processing',
            error: 'Job still processing on fal.ai',
          })
        } else {
          results.push({
            jobId: job.id,
            status: 'failed',
            error: errorMessage,
          })
        }
      }
    }

    return NextResponse.json({
      message: `Attempted to recover ${jobsWithRequestId.length} jobs`,
      results,
      recovered: results.filter(r => r.status === 'recovered').length,
    })
  } catch (error) {
    console.error('Error recovering jobs:', error)
    return NextResponse.json(
      { error: 'Failed to recover jobs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/video-jobs/recover
 * Show stuck jobs that could be recovered
 */
export async function GET() {
  try {
    const stuckJobs = await db
      .select({
        id: videoJobs.id,
        status: videoJobs.status,
        falRequestId: videoJobs.falRequestId,
        error: videoJobs.error,
        createdAt: videoJobs.createdAt,
        updatedAt: videoJobs.updatedAt,
      })
      .from(videoJobs)
      .where(eq(videoJobs.status, 'generating'))

    const jobsWithRequestId = stuckJobs.filter(job => job.falRequestId)

    return NextResponse.json({
      stuckJobs: jobsWithRequestId,
      count: jobsWithRequestId.length,
      message: 'POST to this endpoint to attempt recovery',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list stuck jobs' },
      { status: 500 }
    )
  }
}
