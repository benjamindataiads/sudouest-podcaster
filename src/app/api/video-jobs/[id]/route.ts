import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, videoJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * PATCH /api/video-jobs/[id]
 * Met à jour le statut d'un job vidéo
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, videoUrl, error } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (status) {
      updateData.status = status
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date()
      }
    }
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl
    if (error !== undefined) updateData.error = error

    const [updated] = await db
      .update(videoJobs)
      .set(updateData)
      .where(eq(videoJobs.id, params.id))
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: 'Job non trouvé' },
        { status: 404 }
      )
    }

    console.log(`✅ Updated job ${params.id}: status=${status}`)
    
    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error('Error updating video job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la mise à jour du job',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/video-jobs/[id]
 * Supprime un job vidéo spécifique
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.delete(videoJobs).where(eq(videoJobs.id, params.id))
    
    console.log(`🗑️ Deleted job ${params.id}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la suppression du job',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

