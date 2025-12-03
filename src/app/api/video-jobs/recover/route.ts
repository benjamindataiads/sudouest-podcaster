import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, videoJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as fal from '@fal-ai/serverless-client'

/**
 * POST /api/video-jobs/recover
 * Récupère manuellement le résultat d'un job fal.ai avec le request_id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobId, requestId } = body

    if (!jobId || !requestId) {
      return NextResponse.json(
        { error: 'jobId et requestId requis' },
        { status: 400 }
      )
    }

    console.log(`🔍 Recovering fal.ai result for request: ${requestId}`)

    // Récupérer le statut via le SDK fal
    const statusResponse = await fal.queue.status('fal-ai/kling-video/v1/standard/ai-avatar', {
      requestId,
      logs: true,
    })

    console.log('Fal.ai status:', statusResponse.status)

    if (statusResponse.status !== 'COMPLETED') {
      throw new Error(`Job not completed on fal.ai. Status: ${statusResponse.status}`)
    }

    // Récupérer le résultat
    const result = await fal.queue.result('fal-ai/kling-video/v1/standard/ai-avatar', {
      requestId,
    }) as { video: { url: string }, duration: number }

    const videoUrl = result.video?.url
    if (!videoUrl) {
      throw new Error('No video URL in fal.ai result')
    }

    console.log(`✅ Recovered video URL: ${videoUrl}`)

    // Mettre à jour le job dans la DB
    const [updated] = await db
      .update(videoJobs)
      .set({
        status: 'completed',
        videoUrl: videoUrl,
        falRequestId: requestId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, jobId))
      .returning()

    return NextResponse.json({
      success: true,
      job: updated,
      videoUrl: videoUrl,
    })

  } catch (error) {
    console.error('Error recovering video job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la récupération',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

