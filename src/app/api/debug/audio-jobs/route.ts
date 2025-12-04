import { NextRequest, NextResponse } from 'next/server'
import { db, audioJobs, podcasts } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/audio-jobs
 * Debug endpoint to check audio job status and request IDs
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const podcastId = searchParams.get('podcastId')
  
  try {
    let jobs
    
    if (podcastId) {
      jobs = await db
        .select()
        .from(audioJobs)
        .where(eq(audioJobs.podcastId, parseInt(podcastId)))
        .orderBy(desc(audioJobs.createdAt))
    } else {
      jobs = await db
        .select()
        .from(audioJobs)
        .orderBy(desc(audioJobs.createdAt))
        .limit(10)
    }
    
    // Also get podcast info if podcastId is provided
    let podcast = null
    if (podcastId) {
      const [p] = await db
        .select()
        .from(podcasts)
        .where(eq(podcasts.id, parseInt(podcastId)))
        .limit(1)
      podcast = p
    }
    
    return NextResponse.json({
      podcast: podcast ? {
        id: podcast.id,
        title: podcast.title,
        status: podcast.status,
        avatarId: podcast.avatarId,
        hasAudioChunks: (podcast.audioChunks as unknown[])?.length || 0,
      } : null,
      jobs: jobs.map(job => ({
        id: job.id,
        podcastId: job.podcastId,
        status: job.status,
        voiceId: job.voiceId,
        falRequestIds: job.falRequestIds,
        audioChunksCount: (job.audioChunks as unknown[])?.length || 0,
        audioChunks: job.audioChunks,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      })),
      summary: {
        totalJobs: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        generating: jobs.filter(j => j.status === 'generating').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        queued: jobs.filter(j => j.status === 'queued').length,
      },
    })
    
  } catch (error) {
    console.error('Debug audio-jobs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio jobs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

