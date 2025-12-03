import { NextRequest, NextResponse } from 'next/server'
import { db, audioJobs, videoJobs } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

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
    // Success - update job with video URL
    await db
      .update(videoJobs)
      .set({
        status: 'completed',
        videoUrl: payload.video.url,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, job.id))
    
    console.log(`✅ Video job ${job.id} completed: ${payload.video.url}`)
    
    return NextResponse.json({ success: true, jobId: job.id, type: 'video' })
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
  
  // Get current audio chunks (or initialize empty array)
  const currentChunks = (job.audioChunks || []) as Array<{
    url: string
    chunkIndex: number
    text: string
    section?: string
    articleTitle?: string
    requestId?: string
  }>
  
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
    section: string
    articleTitle?: string
  }>
  const scriptChunk = scriptChunks[chunkIndex]
  
  if (status === 'OK' && payload?.audio?.url) {
    // Add this chunk to the completed chunks
    const newChunk = {
      url: payload.audio.url,
      chunkIndex: chunkIndex,
      text: scriptChunk?.text || '',
      section: scriptChunk?.section,
      articleTitle: scriptChunk?.articleTitle,
      requestId: requestId,
    }
    
    // Update or add the chunk
    const existingIndex = currentChunks.findIndex(c => c.chunkIndex === chunkIndex)
    if (existingIndex >= 0) {
      currentChunks[existingIndex] = newChunk
    } else {
      currentChunks.push(newChunk)
    }
    
    // Sort by chunkIndex
    currentChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    
    // Check if all chunks are complete
    const allComplete = currentChunks.length === falRequestIds.length
    
    await db
      .update(audioJobs)
      .set({
        audioChunks: currentChunks,
        status: allComplete ? 'completed' : 'generating',
        completedAt: allComplete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(audioJobs.id, job.id))
    
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
      }
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
    
    return NextResponse.json({ success: false, jobId: job.id, error: errorMessage })
  }
}

