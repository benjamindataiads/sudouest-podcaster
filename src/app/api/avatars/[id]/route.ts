import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, avatars } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avatars/[id]
 * Get a single avatar by ID (filtered by org)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid avatar ID' }, { status: 400 })
    }
    
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, id))
      .limit(1)
    
    if (!avatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // Check ownership based on org
    if (orgId) {
      // Org mode: avatar must belong to this org
      if (avatar.orgId && avatar.orgId !== orgId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      // Personal mode: avatar must belong to this user
      if (avatar.userId && avatar.userId !== userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }
    
    return NextResponse.json({ avatar })
  } catch (error) {
    console.error('Error fetching avatar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch avatar' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/avatars/[id]
 * Update an avatar (only owner/org can update)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid avatar ID' }, { status: 400 })
    }
    
    const body = await request.json()
    const { name, voiceUrl, imageUrl, imageVariations } = body
    
    // Check if avatar exists
    const [existing] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // Check ownership based on org
    if (orgId) {
      if (existing.orgId && existing.orgId !== orgId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      if (existing.userId && existing.userId !== userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }
    
    // Build update object with only provided fields
    const updateData: Partial<typeof avatars.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Claim avatar for current user/org if not set
    if (!existing.userId) {
      updateData.userId = userId
    }
    if (orgId && !existing.orgId) {
      updateData.orgId = orgId
    }
    
    if (name !== undefined) updateData.name = name
    if (voiceUrl !== undefined) updateData.voiceUrl = voiceUrl
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (imageVariations !== undefined) updateData.imageVariations = imageVariations
    
    const [updatedAvatar] = await db
      .update(avatars)
      .set(updateData)
      .where(eq(avatars.id, id))
      .returning()
    
    console.log(`✅ Updated avatar: ${updatedAvatar.name}`)
    
    return NextResponse.json({ avatar: updatedAvatar })
  } catch (error) {
    console.error('Error updating avatar:', error)
    return NextResponse.json(
      { error: 'Failed to update avatar' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/avatars/[id]
 * Delete an avatar (only owner/org can delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid avatar ID' }, { status: 400 })
    }
    
    // Check if avatar exists
    const [existing] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, id))
      .limit(1)
    
    if (!existing) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // Check ownership based on org
    if (orgId) {
      if (existing.orgId && existing.orgId !== orgId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      if (existing.userId && existing.userId !== userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }
    
    await db.delete(avatars).where(eq(avatars.id, id))
    
    console.log(`🗑️ Deleted avatar: ${existing.name} by user: ${userId} org: ${orgId}`)
    
    return NextResponse.json({ success: true, message: `Avatar "${existing.name}" deleted` })
  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    )
  }
}

