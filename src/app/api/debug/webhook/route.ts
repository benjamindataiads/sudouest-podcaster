import { NextResponse } from 'next/server'
import { getWebhookUrlForDebug } from '@/lib/services/fal'
import { db, videoJobs, audioJobs } from '@/lib/db'
import { desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/webhook
 * Debug endpoint to check webhook configuration and recent jobs
 */
export async function GET() {
  try {
    const webhookUrl = getWebhookUrlForDebug()
    
    // Get environment info
    const envInfo = {
      RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || 'not set',
      RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || 'not set',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      NODE_ENV: process.env.NODE_ENV,
    }
    
    // Get recent video jobs
    const recentVideoJobs = await db
      .select({
        id: videoJobs.id,
        status: videoJobs.status,
        falRequestId: videoJobs.falRequestId,
        videoUrl: videoJobs.videoUrl,
        error: videoJobs.error,
        createdAt: videoJobs.createdAt,
        updatedAt: videoJobs.updatedAt,
      })
      .from(videoJobs)
      .orderBy(desc(videoJobs.createdAt))
      .limit(10)
    
    // Get recent audio jobs
    const recentAudioJobs = await db
      .select({
        id: audioJobs.id,
        status: audioJobs.status,
        falRequestIds: audioJobs.falRequestIds,
        error: audioJobs.error,
        createdAt: audioJobs.createdAt,
        updatedAt: audioJobs.updatedAt,
      })
      .from(audioJobs)
      .orderBy(desc(audioJobs.createdAt))
      .limit(5)
    
    return NextResponse.json({
      webhookUrl,
      envInfo,
      recentVideoJobs,
      recentAudioJobs,
      message: 'Debug info for webhook configuration',
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

