import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { podcasts } from '@/lib/db/schema'
import { sql, eq, and, gte, lt } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db/assign-orgs
 * List all podcasts with their org assignments
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get all podcasts
    const allPodcasts = await db
      .select({
        id: podcasts.id,
        title: podcasts.title,
        createdAt: podcasts.createdAt,
        orgId: podcasts.orgId,
        userId: podcasts.userId,
      })
      .from(podcasts)
      .orderBy(podcasts.createdAt)

    return NextResponse.json({
      podcasts: allPodcasts.map(p => ({
        ...p,
        createdAtStr: p.createdAt?.toISOString(),
        date: p.createdAt?.toLocaleDateString('fr-FR'),
      })),
      total: allPodcasts.length,
      hint: 'POST to this endpoint with babaOrgId and sudOuestOrgId to assign podcasts',
    })
  } catch (error) {
    console.error('Error listing podcasts:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/db/assign-orgs
 * Assign podcasts to organizations based on date
 * - December 6, 2024 podcasts → baba org
 * - All others → Sud Ouest org
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { babaOrgId, sudOuestOrgId } = body

    if (!babaOrgId || !sudOuestOrgId) {
      return NextResponse.json({ 
        error: 'Missing babaOrgId or sudOuestOrgId',
        hint: 'Send POST with { "babaOrgId": "org_xxx", "sudOuestOrgId": "org_yyy" }',
      }, { status: 400 })
    }

    // December 6, 2024 - start and end of day (UTC)
    const dec6Start = new Date('2024-12-06T00:00:00.000Z')
    const dec7Start = new Date('2024-12-07T00:00:00.000Z')

    // Assign Dec 6 podcasts to baba
    const babaResult = await db
      .update(podcasts)
      .set({ orgId: babaOrgId })
      .where(
        and(
          gte(podcasts.createdAt, dec6Start),
          lt(podcasts.createdAt, dec7Start)
        )
      )
      .returning({ id: podcasts.id, title: podcasts.title })

    // Assign all other podcasts to Sud Ouest
    const sudOuestResult = await db
      .update(podcasts)
      .set({ orgId: sudOuestOrgId })
      .where(
        sql`${podcasts.createdAt} < ${dec6Start} OR ${podcasts.createdAt} >= ${dec7Start} OR ${podcasts.orgId} IS NULL`
      )
      .returning({ id: podcasts.id, title: podcasts.title })

    return NextResponse.json({
      success: true,
      assigned: {
        baba: {
          orgId: babaOrgId,
          count: babaResult.length,
          podcasts: babaResult,
        },
        sudOuest: {
          orgId: sudOuestOrgId,
          count: sudOuestResult.length,
          podcasts: sudOuestResult,
        },
      },
    })
  } catch (error) {
    console.error('Error assigning orgs:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

