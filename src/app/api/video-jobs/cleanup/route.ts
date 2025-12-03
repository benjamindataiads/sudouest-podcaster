import { NextResponse } from 'next/server'
import { db, videoJobs } from '@/lib/db'

/**
 * POST /api/video-jobs/cleanup
 * Supprime tous les jobs queued/generating sans fal_request_id (jobs perdus)
 */
export async function POST() {
  try {
    const { sql } = await import('drizzle-orm')
    
    // Supprimer les jobs sans fal_request_id qui sont bloqués
    const deleted = await db
      .delete(videoJobs)
      .where(
        sql`${videoJobs.falRequestId} IS NULL AND (${videoJobs.status} = 'queued' OR ${videoJobs.status} = 'generating')`
      )
      .returning()

    console.log(`🗑️ Cleaned up ${deleted.length} orphaned jobs`)

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
      message: `${deleted.length} jobs orphelins supprimés`,
    })
  } catch (error) {
    console.error('Error cleaning up jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du nettoyage',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

