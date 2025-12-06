import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, avatars } from '@/lib/db'
import { eq, or, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Default avatar data
const DEFAULT_AVATAR = {
  name: 'Benoit Lasserre',
  voiceUrl: 'https://dataiads-test1.fr/sudouest/voix.mp3',
  imageUrl: 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png',
  isDefault: true,
  userId: null as string | null, // Default avatars have no user
}

/**
 * GET /api/avatars
 * Get avatars: default avatars + user's custom avatars
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Get default avatars (isDefault=true) and user's custom avatars
    let allAvatars = await db
      .select()
      .from(avatars)
      .where(or(
        eq(avatars.isDefault, true),
        eq(avatars.userId, userId),
        isNull(avatars.userId) // Legacy avatars without userId
      ))
      .orderBy(avatars.createdAt)
    
    // If no avatars exist, create the default one
    if (allAvatars.length === 0) {
      const [defaultAvatar] = await db
        .insert(avatars)
        .values(DEFAULT_AVATAR)
        .returning()
      
      allAvatars = [defaultAvatar]
      console.log('✅ Created default avatar: Benoit Lasserre')
    }
    
    return NextResponse.json({ avatars: allAvatars })
  } catch (error) {
    console.error('Error fetching avatars:', error)
    return NextResponse.json(
      { error: 'Failed to fetch avatars', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/avatars
 * Create a new avatar for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { name, voiceUrl, imageUrl, imageVariations } = body
    
    if (!name || !voiceUrl || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: name, voiceUrl, imageUrl' },
        { status: 400 }
      )
    }
    
    const [newAvatar] = await db
      .insert(avatars)
      .values({
        userId, // Associate with current user
        name,
        voiceUrl,
        imageUrl,
        imageVariations: imageVariations || null,
        isDefault: false,
      })
      .returning()
    
    console.log(`✅ Created avatar: ${name} for user: ${userId} with ${imageVariations?.length || 0} variations`)
    
    return NextResponse.json({ avatar: newAvatar })
  } catch (error) {
    console.error('Error creating avatar:', error)
    return NextResponse.json(
      { error: 'Failed to create avatar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

