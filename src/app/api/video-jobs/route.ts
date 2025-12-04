import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { db, videoJobs } from '@/lib/db'
import { eq, or, and } from 'drizzle-orm'

/**
 * GET /api/video-jobs
 * Récupère tous les jobs vidéo (ou filtrés par podcast/status)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')
    const status = searchParams.get('status')

    let query = db.select().from(videoJobs)

    // Filtrer par podcastId si fourni
    if (podcastId) {
      const conditions = [eq(videoJobs.podcastId, parseInt(podcastId))]
      
      // Filtrer par status si fourni
      if (status) {
        conditions.push(eq(videoJobs.status, status))
      }
      
      const jobs = await query.where(and(...conditions))
      return NextResponse.json({ jobs, count: jobs.length })
    }

    // Tous les jobs, triés par date de création
    const allJobs = await query.orderBy(videoJobs.createdAt)
    
    return NextResponse.json({ 
      jobs: allJobs,
      count: allJobs.length 
    })
  } catch (error) {
    console.error('Error fetching video jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la récupération des jobs',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/video-jobs
 * Crée un nouveau job vidéo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, podcastId, audioChunkIndex, audioUrl, text, section, avatarImageUrl, status = 'queued' } = body

    if (!id || audioChunkIndex === undefined || !audioUrl) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id, audioChunkIndex, audioUrl requis' },
        { status: 400 }
      )
    }

    const [newJob] = await db
      .insert(videoJobs)
      .values({
        id,
        podcastId: podcastId || null,
        audioChunkIndex,
        audioUrl,
        text: text || null,
        section: section || null,
        avatarImageUrl: avatarImageUrl || null, // Image variant for this segment
        status,
      })
      .returning()

    console.log(`✅ Created video job: ${id} (image: ${avatarImageUrl || 'default'})`)
    
    return NextResponse.json({ job: newJob })
  } catch (error) {
    console.error('Error creating video job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la création du job',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/video-jobs
 * Supprime tous les jobs (ou filtrés par podcast)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')

    if (podcastId) {
      await db.delete(videoJobs).where(eq(videoJobs.podcastId, parseInt(podcastId)))
      console.log(`🗑️ Deleted all jobs for podcast ${podcastId}`)
    } else {
      await db.delete(videoJobs)
      console.log('🗑️ Deleted all video jobs')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting video jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la suppression des jobs',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

