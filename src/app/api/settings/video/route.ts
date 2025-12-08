import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, organizationSettings, type OrganizationVideoSettings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { uploadBuffer, isBucketConfigured } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/video
 * Get organization video settings (intro/outro)
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)

    return NextResponse.json({
      videoSettings: settings?.videoSettings || {},
    })

  } catch (error) {
    console.error('Error fetching video settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/video
 * Update organization video settings
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoSettings } = body as { videoSettings: Partial<OrganizationVideoSettings> }

    // Get existing settings
    const [existingSettings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)

    if (!existingSettings) {
      return NextResponse.json(
        { error: 'Organization settings not found' },
        { status: 404 }
      )
    }

    // Merge video settings
    const updatedVideoSettings = {
      ...existingSettings.videoSettings,
      ...videoSettings,
    }

    await db
      .update(organizationSettings)
      .set({
        videoSettings: updatedVideoSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.orgId, orgId))

    return NextResponse.json({
      success: true,
      videoSettings: updatedVideoSettings,
    })

  } catch (error) {
    console.error('Error updating video settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/video
 * Remove intro or outro video
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'intro' or 'outro'

    if (!type || !['intro', 'outro'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    const [existingSettingsDelete] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)

    if (!existingSettingsDelete) {
      return NextResponse.json(
        { error: 'Organization settings not found' },
        { status: 404 }
      )
    }

    const currentVideoSettings = existingSettingsDelete.videoSettings || {}
    
    const updatedVideoSettings = {
      ...currentVideoSettings,
      ...(type === 'intro' ? {
        introVideoUrl: undefined,
        introImageUrl: undefined,
        introPrompt: undefined,
      } : {
        outroVideoUrl: undefined,
        outroImageUrl: undefined,
        outroPrompt: undefined,
      }),
    }

    await db
      .update(organizationSettings)
      .set({
        videoSettings: updatedVideoSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.orgId, orgId))

    return NextResponse.json({
      success: true,
      type,
    })

  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}

