import { NextRequest, NextResponse } from 'next/server'
import { db, avatars } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Default avatar data
const DEFAULT_AVATAR = {
  name: 'Benoit Lasserre',
  voiceUrl: 'https://dataiads-test1.fr/sudouest/voix.mp3',
  imageUrl: 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png',
  isDefault: true,
}

/**
 * GET /api/avatars
 * Get all avatars, create default if none exist
 */
export async function GET() {
  try {
    let allAvatars = await db.select().from(avatars).orderBy(avatars.createdAt)
    
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
 * Create a new avatar
 */
export async function POST(request: NextRequest) {
  try {
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
        name,
        voiceUrl,
        imageUrl,
        imageVariations: imageVariations || null,
        isDefault: false,
      })
      .returning()
    
    console.log(`✅ Created avatar: ${name} with ${imageVariations?.length || 0} variations`)
    
    return NextResponse.json({ avatar: newAvatar })
  } catch (error) {
    console.error('Error creating avatar:', error)
    return NextResponse.json(
      { error: 'Failed to create avatar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

