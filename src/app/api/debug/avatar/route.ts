import { NextRequest, NextResponse } from 'next/server'
import { db, avatars, podcasts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/avatar?podcastId=12
 * Debug endpoint to check avatar for a podcast
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const podcastId = searchParams.get('podcastId')
  const avatarId = searchParams.get('avatarId')
  
  try {
    let result: Record<string, unknown> = {}
    
    // Get all avatars
    const allAvatars = await db.select().from(avatars)
    result.allAvatars = allAvatars.map(a => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      voiceUrl: a.voiceUrl,
      isDefault: a.isDefault,
    }))
    
    // Get specific avatar if avatarId provided
    if (avatarId) {
      const [avatar] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.id, parseInt(avatarId)))
        .limit(1)
      
      result.avatar = avatar || null
    }
    
    // Get podcast and its avatar if podcastId provided
    if (podcastId) {
      const [podcast] = await db
        .select()
        .from(podcasts)
        .where(eq(podcasts.id, parseInt(podcastId)))
        .limit(1)
      
      result.podcast = podcast ? {
        id: podcast.id,
        title: podcast.title,
        avatarId: podcast.avatarId,
        status: podcast.status,
      } : null
      
      if (podcast?.avatarId) {
        const [avatar] = await db
          .select()
          .from(avatars)
          .where(eq(avatars.id, podcast.avatarId))
          .limit(1)
        
        result.podcastAvatar = avatar || null
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Debug avatar error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch avatar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

