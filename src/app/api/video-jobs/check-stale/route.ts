import { NextResponse } from 'next/server'
import { db, videoJobs } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/video-jobs/check-stale
 * Vérifie et réinitialise les jobs bloqués en "generating" depuis trop longtemps
 */
export async function GET() {
  try {
    // Chercher les jobs bloqués depuis plus de 15 minutes
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000) // 15 minutes

    const staleJobs = await db
      .select()
      .from(videoJobs)
      .where(
        sql`${videoJobs.status} = 'generating' AND ${videoJobs.updatedAt} < ${staleThreshold.toISOString()}`
      )

    if (staleJobs.length > 0) {
      console.log(`⚠️ Found ${staleJobs.length} stale jobs, resetting to queued...`)
      
      // Réinitialiser en "queued" pour retry
      for (const job of staleJobs) {
        await db
          .update(videoJobs)
          .set({
            status: 'queued',
            updatedAt: new Date(),
            error: 'Job was stale, reset for retry',
          })
          .where(sql`${videoJobs.id} = ${job.id}`)
      }
    }

    return NextResponse.json({
      staleJobsFound: staleJobs.length,
      message: staleJobs.length > 0 
        ? `Reset ${staleJobs.length} stale jobs` 
        : 'No stale jobs found',
    })
  } catch (error) {
    console.error('Error checking stale jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la vérification des jobs bloqués',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

