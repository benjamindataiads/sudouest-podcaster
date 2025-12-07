import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { db, audioJobs, podcasts } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'

/**
 * GET /api/audio-jobs
 * Récupère les jobs audio filtrés par organisation
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')

    if (podcastId) {
      const podcastIdNum = parseInt(podcastId)
      
      // Verify podcast belongs to current org/user
      let podcast
      if (orgId) {
        const [result] = await db
          .select()
          .from(podcasts)
          .where(and(eq(podcasts.id, podcastIdNum), eq(podcasts.orgId, orgId)))
          .limit(1)
        podcast = result
      } else {
        const [result] = await db
          .select()
          .from(podcasts)
          .where(and(eq(podcasts.id, podcastIdNum), eq(podcasts.userId, userId)))
          .limit(1)
        podcast = result
      }
      
      if (!podcast) {
        return NextResponse.json({ jobs: [], count: 0 })
      }

      const jobs = await db
        .select()
        .from(audioJobs)
        .where(eq(audioJobs.podcastId, podcastIdNum))

      return NextResponse.json({ jobs, count: jobs.length })
    }

    // Get all podcasts for this org/user, then get their jobs
    let orgPodcasts
    if (orgId) {
      orgPodcasts = await db.select({ id: podcasts.id }).from(podcasts).where(eq(podcasts.orgId, orgId))
    } else {
      orgPodcasts = await db.select({ id: podcasts.id }).from(podcasts).where(eq(podcasts.userId, userId))
    }
    
    if (orgPodcasts.length === 0) {
      return NextResponse.json({ jobs: [], count: 0 })
    }
    
    const podcastIds = orgPodcasts.map(p => p.id)
    const allJobs = await db
      .select()
      .from(audioJobs)
      .where(inArray(audioJobs.podcastId, podcastIds))
      .orderBy(audioJobs.createdAt)
    
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
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { id, podcastId, scriptChunks, voiceUrl, voiceId, status = 'queued' } = body

    // Support both voiceUrl (new) and voiceId (legacy)
    const voice = voiceUrl || voiceId
    if (!id || !voice) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id, voiceUrl requis' },
        { status: 400 }
      )
    }

    // Verify podcast belongs to this org/user if podcastId is provided
    if (podcastId) {
      let podcast
      if (orgId) {
        const [result] = await db
          .select()
          .from(podcasts)
          .where(and(eq(podcasts.id, podcastId), eq(podcasts.orgId, orgId)))
          .limit(1)
        podcast = result
      } else {
        const [result] = await db
          .select()
          .from(podcasts)
          .where(and(eq(podcasts.id, podcastId), eq(podcasts.userId, userId)))
          .limit(1)
        podcast = result
      }
      
      if (!podcast) {
        return NextResponse.json({ error: 'Podcast non trouvé' }, { status: 404 })
      }
    }

    const [newJob] = await db
      .insert(audioJobs)
      .values({
        id,
        podcastId: podcastId || null,
        scriptChunks: scriptChunks || null,
        voiceId: voice,
        status,
      })
      .returning()

    console.log(`✅ Created audio job: ${id} with voice: ${voice}`)
    
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

