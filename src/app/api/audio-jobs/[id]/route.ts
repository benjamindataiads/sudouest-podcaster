import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, audioJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/audio-jobs/[id]
 * Récupère un job audio spécifique (pour polling)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [job] = await db
      .select()
      .from(audioJobs)
      .where(eq(audioJobs.id, params.id))
      .limit(1)

    if (!job) {
      return NextResponse.json(
        { error: 'Job non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error fetching audio job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la récupération du job audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/audio-jobs/[id]
 * Met à jour le statut d'un job audio
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, audioUrl, audioChunks, error } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (status) {
      updateData.status = status
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date()
      }
    }
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl
    if (audioChunks !== undefined) updateData.audioChunks = audioChunks
    if (error !== undefined) updateData.error = error

    const [updated] = await db
      .update(audioJobs)
      .set(updateData)
      .where(eq(audioJobs.id, params.id))
      .returning()

    if (!updated) {
      return NextResponse.json(
        { error: 'Job non trouvé' },
        { status: 404 }
      )
    }

    console.log(`✅ Updated audio job ${params.id}: status=${status}`)
    
    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error('Error updating audio job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la mise à jour du job audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

