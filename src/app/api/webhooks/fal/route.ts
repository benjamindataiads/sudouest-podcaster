import { NextRequest, NextResponse } from 'next/server'
import { db, audioJobs, videoJobs } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { uploadAudioToBucket, uploadVideoToBucket, isBucketConfigured } from '@/lib/services/storage'
import { notifyJobCompleted, notifyJobFailed } from '@/lib/genai/sse-manager'

export const dynamic = 'force-dynamic'

/**
 * GET /api/webhooks/fal
 * Health check endpoint to verify webhook is accessible
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Fal.ai webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}

/**
 * POST /api/webhooks/fal
 * Receives callbacks from fal.ai when jobs are completed
 * 
 * Payload structure from fal.ai:
 * {
 *   request_id: string,
 *   status: "OK" | "ERROR",
 *   payload: { ... } | null,
 *   error?: string,
 *   payload_error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('📥 Fal.ai webhook received:', JSON.stringify(body, null, 2))
    
    const { request_id, status, payload, error, payload_error } = body
    
    if (!request_id) {
      console.error('❌ Webhook missing request_id')
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 })
    }
    
    // Determine job type by checking both tables
    // First check video jobs
    const [videoJob] = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.falRequestId, request_id))
      .limit(1)
    
    if (videoJob) {
      return handleVideoJobCallback(videoJob, status, payload, error, payload_error)
    }
    
    // Check audio jobs (request_id is stored in falRequestIds array)
    const audioJobsWithRequest = await db
      .select()
      .from(audioJobs)
      .where(sql`${audioJobs.falRequestIds}::jsonb @> ${JSON.stringify([request_id])}::jsonb`)
      .limit(1)
    
    if (audioJobsWithRequest.length > 0) {
      return handleAudioChunkCallback(audioJobsWithRequest[0], request_id, status, payload, error, payload_error)
    }
    
    console.warn(`⚠️ No job found for request_id: ${request_id}`)
    return NextResponse.json({ warning: 'No matching job found' }, { status: 200 })
    
  } catch (err) {
    console.error('❌ Webhook error:', err)
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

/**
 * Handle video job completion callback
 */
async function handleVideoJobCallback(
  job: typeof videoJobs.$inferSelect,
  status: string,
  payload: { video?: { url?: string }, duration?: number } | null,
  error?: string,
  payload_error?: string
) {
  console.log(`🎬 Processing video job callback: ${job.id}`)
  
  if (status === 'OK' && payload?.video?.url) {
    let finalVideoUrl = payload.video.url
    
    // Upload to bucket if configured (permanent storage)
    if (isBucketConfigured()) {
      try {
        console.log(`📤 Uploading video to bucket...`)
        finalVideoUrl = await uploadVideoToBucket(payload.video.url, job.id)
        console.log(`✅ Video uploaded to bucket: ${finalVideoUrl}`)
      } catch (uploadError) {
        console.error(`⚠️ Bucket upload failed, using fal.ai URL:`, uploadError)
        // Continue with fal.ai URL if bucket upload fails
      }
    }
    
    // Success - update job with video URL
    await db
      .update(videoJobs)
      .set({
        status: 'completed',
        videoUrl: finalVideoUrl,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, job.id))
    
    console.log(`✅ Video job ${job.id} completed: ${finalVideoUrl}`)
    
    // Notify via SSE
    if (job.podcastId) {
      notifyJobCompleted(job.podcastId, job.id, 'video', { videoUrl: finalVideoUrl })
    }
    
    return NextResponse.json({ success: true, jobId: job.id, type: 'video', videoUrl: finalVideoUrl })
  } else {
    // Error - update job with error
    const errorMessage = error || payload_error || 'Unknown error from fal.ai'
    
    await db
      .update(videoJobs)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, job.id))
    
    console.error(`❌ Video job ${job.id} failed: ${errorMessage}`)
    
    // Notify via SSE
    if (job.podcastId) {
      notifyJobFailed(job.podcastId, job.id, 'video', errorMessage)
    }
    
    return NextResponse.json({ success: false, jobId: job.id, error: errorMessage })
  }
}

/**
 * Handle audio chunk completion callback
 * Audio jobs have multiple chunks, each with their own request_id
 */
async function handleAudioChunkCallback(
  job: typeof audioJobs.$inferSelect,
  requestId: string,
  status: string,
  payload: { audio?: { url?: string } } | null,
  error?: string,
  payload_error?: string
) {
  console.log(`🎤 Processing audio chunk callback for job: ${job.id}, request: ${requestId}`)
  
  type SectionType = 'introduction' | 'article' | 'conclusion'
  
  // Find the index of this request in the falRequestIds array
  const falRequestIds = (job.falRequestIds || []) as string[]
  const chunkIndex = falRequestIds.indexOf(requestId)
  
  if (chunkIndex === -1) {
    console.error(`❌ Request ${requestId} not found in job ${job.id} falRequestIds`)
    return NextResponse.json({ error: 'Request not found in job' }, { status: 400 })
  }
  
  // Get script chunks to find text/section info
  const scriptChunks = (job.scriptChunks || []) as Array<{
    text: string
    index: number
    section: SectionType
    articleTitle?: string
  }>
  const scriptChunk = scriptChunks[chunkIndex]
  
  if (status === 'OK' && payload?.audio?.url) {
    let audioUrl = payload.audio.url
    
    // Upload to bucket if configured (permanent storage)
    if (isBucketConfigured()) {
      try {
        console.log(`📤 Uploading audio chunk ${chunkIndex} to bucket...`)
        audioUrl = await uploadAudioToBucket(payload.audio.url, job.id, chunkIndex)
        console.log(`✅ Audio chunk uploaded: ${audioUrl}`)
      } catch (uploadError) {
        console.error(`⚠️ Bucket upload failed, using fal.ai URL:`, uploadError)
        // Continue with fal.ai URL if bucket upload fails
      }
    }
    
    // Create the new chunk
    const newChunk = {
      url: audioUrl,
      chunkIndex: chunkIndex,
      text: scriptChunk?.text || '',
      section: scriptChunk?.section,
      articleTitle: scriptChunk?.articleTitle,
      requestId: requestId,
    }
    
    // ATOMIC UPDATE: Re-fetch job and update to avoid race conditions
    // Use a retry loop in case of concurrent updates
    let retries = 3
    let updatedChunks: typeof newChunk[] = []
    let allComplete = false
    
    while (retries > 0) {
      try {
        // Re-fetch the latest job state
        const [freshJob] = await db
          .select()
          .from(audioJobs)
          .where(eq(audioJobs.id, job.id))
          .limit(1)
        
        if (!freshJob) {
          throw new Error('Job not found')
        }
        
        // Get current chunks from fresh data
        const currentChunks = (freshJob.audioChunks || []) as typeof newChunk[]
        
        // Check if this chunk already exists
        const existingIndex = currentChunks.findIndex(c => c.chunkIndex === chunkIndex)
        if (existingIndex >= 0) {
          currentChunks[existingIndex] = newChunk
        } else {
          currentChunks.push(newChunk)
        }
        
        // Sort by chunkIndex
        currentChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
        
        // Check if all chunks are complete
        allComplete = currentChunks.length === falRequestIds.length
        updatedChunks = currentChunks
        
        // Update with the merged chunks
        await db
          .update(audioJobs)
          .set({
            audioChunks: currentChunks,
            status: allComplete ? 'completed' : 'generating',
            completedAt: allComplete ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(audioJobs.id, job.id))
        
        break // Success, exit retry loop
        
      } catch (err) {
        retries--
        console.warn(`⚠️ Retry ${3 - retries}/3 for chunk ${chunkIndex}:`, err)
        if (retries === 0) throw err
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Use the final updated chunks
    const currentChunks = updatedChunks
    
    console.log(`✅ Audio chunk ${chunkIndex + 1}/${falRequestIds.length} completed for job ${job.id}`)
    
    if (allComplete) {
      console.log(`🎉 All audio chunks complete for job ${job.id}!`)
      
      // Update podcast if linked
      if (job.podcastId) {
        const { podcasts } = await import('@/lib/db')
        await db
          .update(podcasts)
          .set({
            audioChunks: currentChunks,
            status: 'audio_generated',
            currentStep: 4,
            updatedAt: new Date(),
          })
          .where(eq(podcasts.id, job.podcastId))
        
        console.log(`✅ Podcast ${job.podcastId} updated with completed audio`)
        
        // Notify via SSE that all audio is complete
        notifyJobCompleted(job.podcastId, job.id, 'audio', { 
          audioChunks: currentChunks,
          allComplete: true,
        })
      }
    } else if (job.podcastId) {
      // Notify progress (chunk completed but not all)
      notifyJobCompleted(job.podcastId, job.id, 'audio', { 
        chunkIndex,
        chunkUrl: audioUrl,
        completedChunks: currentChunks.length,
        totalChunks: falRequestIds.length,
        allComplete: false,
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      jobId: job.id, 
      type: 'audio',
      chunkIndex,
      allComplete 
    })
  } else {
    // Error for this chunk
    const errorMessage = error || payload_error || 'Unknown error from fal.ai'
    
    await db
      .update(audioJobs)
      .set({
        status: 'failed',
        error: `Chunk ${chunkIndex} failed: ${errorMessage}`,
        updatedAt: new Date(),
      })
      .where(eq(audioJobs.id, job.id))
    
    console.error(`❌ Audio chunk ${chunkIndex} failed for job ${job.id}: ${errorMessage}`)
    
    // Notify via SSE
    if (job.podcastId) {
      notifyJobFailed(job.podcastId, job.id, 'audio', errorMessage)
    }
    
    return NextResponse.json({ success: false, jobId: job.id, error: errorMessage })
  }
}

