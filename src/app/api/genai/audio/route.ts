/**
 * Audio Generation API
 * 
 * POST /api/genai/audio
 * 
 * Generates audio from script chunks using Minimax Voice Clone.
 * Results are delivered via SSE when the fal.ai webhook is received.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, audioJobs, podcasts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { submitVoiceClone, DEFAULT_VOICE_URL } from '@/lib/genai/fal/models/voice-clone'
import { notifyJobCreated } from '@/lib/genai/sse-manager'
import type { AudioGenerationInput } from '@/lib/genai/types'

export const dynamic = 'force-dynamic'

// ============================================
// Types
// ============================================

interface ScriptChunk {
  text: string
  index: number
  section: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

interface AudioGenerationRequest {
  podcastId: number
  scriptChunks: ScriptChunk[]
  voiceUrl?: string
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: AudioGenerationRequest = await request.json()
    const { podcastId, scriptChunks, voiceUrl } = body
    
    // Validation
    if (!podcastId) {
      return NextResponse.json(
        { error: 'podcastId is required' },
        { status: 400 }
      )
    }
    
    if (!scriptChunks || scriptChunks.length === 0) {
      return NextResponse.json(
        { error: 'scriptChunks is required and must not be empty' },
        { status: 400 }
      )
    }
    
    console.log(`🎤 Starting audio generation for podcast ${podcastId}`)
    console.log(`   Chunks: ${scriptChunks.length}`)
    console.log(`   Voice URL: ${voiceUrl || DEFAULT_VOICE_URL}`)
    
    // Get the voice URL from the podcast's avatar if not provided
    let finalVoiceUrl = voiceUrl
    if (!finalVoiceUrl) {
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
          finalVoiceUrl = avatar.voiceUrl
          console.log(`   Using avatar voice: ${avatar.name}`)
        }
      }
    }
    
    finalVoiceUrl = finalVoiceUrl || DEFAULT_VOICE_URL
    
    // Create a job ID
    const jobId = `audio-${podcastId}-${Date.now()}`
    
    // Submit all chunks to fal.ai in parallel
    const submissionPromises = scriptChunks.map(async (chunk) => {
      const input: AudioGenerationInput = {
        text: chunk.text,
        voiceUrl: finalVoiceUrl,
        chunkIndex: chunk.index,
        section: chunk.section,
        articleTitle: chunk.articleTitle,
      }
      
      const { requestId } = await submitVoiceClone(input)
      return {
        chunkIndex: chunk.index,
        requestId,
        text: chunk.text,
        section: chunk.section,
        articleTitle: chunk.articleTitle,
      }
    })
    
    const submissions = await Promise.all(submissionPromises)
    const requestIds = submissions.map(s => s.requestId)
    
    console.log(`✅ Submitted ${requestIds.length} audio chunks to fal.ai`)
    
    // Save job to database
    await db.insert(audioJobs).values({
      id: jobId,
      podcastId,
      scriptChunks,
      voiceId: finalVoiceUrl,
      status: 'generating',
      falRequestIds: requestIds,
    })
    
    // Also update podcast status
    await db
      .update(podcasts)
      .set({
        status: 'audio_generating',
        updatedAt: new Date(),
      })
      .where(eq(podcasts.id, podcastId))
    
    // Notify via SSE that job was created
    notifyJobCreated(podcastId, jobId, 'audio')
    
    return NextResponse.json({
      success: true,
      jobId,
      podcastId,
      chunksSubmitted: requestIds.length,
      requestIds,
      message: 'Audio generation started. Connect to /api/genai/stream for real-time updates.',
    })
    
  } catch (error) {
    console.error('❌ Audio generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start audio generation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
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
        .from(audioJobs)
        .where(eq(audioJobs.id, jobId))
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
        .from(audioJobs)
        .where(eq(audioJobs.podcastId, parseInt(podcastId)))
      
      return NextResponse.json({ jobs })
    }
    
    return NextResponse.json(
      { error: 'podcastId or jobId required' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('❌ Error fetching audio jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

