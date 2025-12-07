import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { db, videoJobs, podcasts } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'

/**
 * GET /api/video-jobs
 * Récupère les jobs vidéo filtrés par organisation
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')
    const status = searchParams.get('status')

    // If podcastId is provided, verify it belongs to this org/user first
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

      const conditions = [eq(videoJobs.podcastId, podcastIdNum)]
      if (status) {
        conditions.push(eq(videoJobs.status, status))
      }
      
      const jobs = await db.select().from(videoJobs).where(and(...conditions))
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
      .from(videoJobs)
      .where(inArray(videoJobs.podcastId, podcastIds))
      .orderBy(videoJobs.createdAt)
    
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
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { id, podcastId, audioChunkIndex, audioUrl, text, section, avatarImageUrl, status = 'queued' } = body

    if (!id || audioChunkIndex === undefined || !audioUrl) {
      return NextResponse.json(
        { error: 'Paramètres manquants: id, audioChunkIndex, audioUrl requis' },
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
      .insert(videoJobs)
      .values({
        id,
        podcastId: podcastId || null,
        audioChunkIndex,
        audioUrl,
        text: text || null,
        section: section || null,
        avatarImageUrl: avatarImageUrl || null,
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
 * Supprime les jobs d'un podcast (vérifie l'ownership)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const podcastId = searchParams.get('podcastId')

    if (!podcastId) {
      return NextResponse.json({ error: 'podcastId requis' }, { status: 400 })
    }

    const podcastIdNum = parseInt(podcastId)
    
    // Verify podcast belongs to this org/user
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
      return NextResponse.json({ error: 'Podcast non trouvé' }, { status: 404 })
    }

    await db.delete(videoJobs).where(eq(videoJobs.podcastId, podcastIdNum))
    console.log(`🗑️ Deleted all jobs for podcast ${podcastId}`)

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

