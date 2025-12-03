import { NextRequest, NextResponse } from 'next/server'
import { db, audioJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/audio-jobs
 * Récupère les jobs audio (filtrés par podcast si fourni)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')

    if (podcastId) {
      const jobs = await db
        .select()
        .from(audioJobs)
        .where(eq(audioJobs.podcastId, parseInt(podcastId)))

      return NextResponse.json({ jobs, count: jobs.length })
    }

    const allJobs = await db.select().from(audioJobs).orderBy(audioJobs.createdAt)
    
    return NextResponse.json({ 
      jobs: allJobs,
      count: allJobs.length 
    })
  } catch (error) {
    console.error('Error fetching audio jobs:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la récupération des jobs audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/audio-jobs
 * Crée un nouveau job audio
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, podcastId, scriptChunks, voiceId, status = 'queued' } = body

    if (!id || !voiceId) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id, voiceId requis' },
        { status: 400 }
      )
    }

    const [newJob] = await db
      .insert(audioJobs)
      .values({
        id,
        podcastId: podcastId || null,
        scriptChunks: scriptChunks || null,
        voiceId,
        status,
      })
      .returning()

    console.log(`✅ Created audio job: ${id}`)
    
    return NextResponse.json({ job: newJob })
  } catch (error) {
    console.error('Error creating audio job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la création du job audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

