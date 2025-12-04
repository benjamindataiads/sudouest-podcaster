/**
 * Video Generation API
 * 
 * POST /api/genai/video
 * 
 * Generates lip-sync avatar video from audio using Kling AI Avatar.
 * Results are delivered via SSE when the fal.ai webhook is received.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, videoJobs, podcasts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { submitAvatarVideo, DEFAULT_AVATAR_IMAGE_URL } from '@/lib/genai/fal/models/avatar-video'
import { notifyJobCreated } from '@/lib/genai/sse-manager'
import type { VideoGenerationInput } from '@/lib/genai/types'

export const dynamic = 'force-dynamic'

// ============================================
// Types
// ============================================

interface VideoGenerationRequest {
  podcastId: number
  audioUrl: string
  audioChunkIndex: number
  text?: string
  section?: string
  imageUrl?: string // Avatar image URL
}

interface BatchVideoGenerationRequest {
  podcastId: number
  chunks: Array<{
    audioUrl: string
    audioChunkIndex: number
    text?: string
    section?: string
  }>
  imageUrl?: string
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if it's a batch request
    if (body.chunks && Array.isArray(body.chunks)) {
      return handleBatchRequest(body as BatchVideoGenerationRequest)
    }
    
    // Single video request
    return handleSingleRequest(body as VideoGenerationRequest)
    
  } catch (error) {
    console.error('❌ Video generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start video generation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

async function handleSingleRequest(body: VideoGenerationRequest) {
  const { podcastId, audioUrl, audioChunkIndex, text, section, imageUrl } = body
  
  // Validation
  if (!podcastId) {
    return NextResponse.json(
      { error: 'podcastId is required' },
      { status: 400 }
    )
  }
  
  if (!audioUrl) {
    return NextResponse.json(
      { error: 'audioUrl is required' },
      { status: 400 }
    )
  }
  
  console.log(`🎬 Starting video generation for podcast ${podcastId}, chunk ${audioChunkIndex}`)
  
  // Get avatar image URL from podcast if not provided
  let finalImageUrl: string = imageUrl || ''
  if (!finalImageUrl) {
    const avatarImage = await getAvatarImageUrl(podcastId)
    finalImageUrl = avatarImage || DEFAULT_AVATAR_IMAGE_URL
  }
  
  console.log(`   Audio: ${audioUrl}`)
  console.log(`   Image: ${finalImageUrl}`)
  
  // Create job ID
  const jobId = `video-${podcastId}-${audioChunkIndex}-${Date.now()}`
  
  // Submit to fal.ai
  const input: VideoGenerationInput = {
    audioUrl,
    imageUrl: finalImageUrl,
  }
  
  const { requestId } = await submitAvatarVideo(input)
  
  console.log(`✅ Submitted video job to fal.ai: ${requestId}`)
  
  // Save job to database
  await db.insert(videoJobs).values({
    id: jobId,
    podcastId,
    audioChunkIndex,
    audioUrl,
    text: text || null,
    section: section || null,
    status: 'generating',
    falRequestId: requestId,
  })
  
  // Notify via SSE
  notifyJobCreated(podcastId, jobId, 'video')
  
  return NextResponse.json({
    success: true,
    jobId,
    podcastId,
    audioChunkIndex,
    requestId,
    message: 'Video generation started. Connect to /api/genai/stream for real-time updates.',
  })
}

async function handleBatchRequest(body: BatchVideoGenerationRequest) {
  const { podcastId, chunks, imageUrl } = body
  
  // Validation
  if (!podcastId) {
    return NextResponse.json(
      { error: 'podcastId is required' },
      { status: 400 }
    )
  }
  
  if (!chunks || chunks.length === 0) {
    return NextResponse.json(
      { error: 'chunks is required and must not be empty' },
      { status: 400 }
    )
  }
  
  console.log(`🎬 Starting batch video generation for podcast ${podcastId}`)
  console.log(`   Chunks: ${chunks.length}`)
  
  // Get avatar image URL from podcast if not provided
  let finalImageUrl: string = imageUrl || ''
  if (!finalImageUrl) {
    const avatarImage = await getAvatarImageUrl(podcastId)
    finalImageUrl = avatarImage || DEFAULT_AVATAR_IMAGE_URL
  }
  
  console.log(`   Image: ${finalImageUrl}`)
  
  // Submit all chunks in parallel
  const jobs = await Promise.all(
    chunks.map(async (chunk) => {
      const jobId = `video-${podcastId}-${chunk.audioChunkIndex}-${Date.now()}`
      
      const input: VideoGenerationInput = {
        audioUrl: chunk.audioUrl,
        imageUrl: finalImageUrl!,
      }
      
      const { requestId } = await submitAvatarVideo(input)
      
      // Save to DB
      await db.insert(videoJobs).values({
        id: jobId,
        podcastId,
        audioChunkIndex: chunk.audioChunkIndex,
        audioUrl: chunk.audioUrl,
        text: chunk.text || null,
        section: chunk.section || null,
        status: 'generating',
        falRequestId: requestId,
      })
      
      // Notify via SSE
      notifyJobCreated(podcastId, jobId, 'video')
      
      return {
        jobId,
        audioChunkIndex: chunk.audioChunkIndex,
        requestId,
      }
    })
  )
  
  console.log(`✅ Submitted ${jobs.length} video jobs to fal.ai`)
  
  // Update podcast status
  await db
    .update(podcasts)
    .set({
      status: 'video_generating',
      updatedAt: new Date(),
    })
    .where(eq(podcasts.id, podcastId))
  
  return NextResponse.json({
    success: true,
    podcastId,
    jobsSubmitted: jobs.length,
    jobs,
    message: 'Batch video generation started. Connect to /api/genai/stream for real-time updates.',
  })
}

// ============================================
// Helper Functions
// ============================================

async function getAvatarImageUrl(podcastId: number): Promise<string | null> {
  const [podcast] = await db
    .select()
    .from(podcasts)
    .where(eq(podcasts.id, podcastId))
    .limit(1)
  
  if (podcast?.avatarId) {
    const { avatars } = await import('@/lib/db')
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, podcast.avatarId))
      .limit(1)
    
    if (avatar) {
      console.log(`   Using avatar image: ${avatar.name}`)
      return avatar.imageUrl
    }
  }
  
  return null
}

// ============================================
// GET Handler - Check job status
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const podcastId = searchParams.get('podcastId')
  const jobId = searchParams.get('jobId')
  
  try {
    if (jobId) {
      // Get specific job
      const [job] = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1)
      
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      
      return NextResponse.json({ job })
    }
    
    if (podcastId) {
      // Get all jobs for podcast
      const jobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.podcastId, parseInt(podcastId)))
      
      return NextResponse.json({ jobs })
    }
    
    return NextResponse.json(
      { error: 'podcastId or jobId required' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('❌ Error fetching video jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

