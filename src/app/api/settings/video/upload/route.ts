import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, organizationSettings } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { uploadBuffer, isBucketConfigured } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/video/upload
 * Upload intro or outro video
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'intro' or 'outro'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!type || !['intro', 'outro'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP4, WebM, and MOV are supported.' },
        { status: 400 }
      )
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      )
    }

    console.log(`📤 Uploading ${type} video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to R2
    if (!isBucketConfigured()) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      )
    }

    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'mp4'
    const fileName = `intro-outro/${orgId}/${type}_${timestamp}.${ext}`

    const videoUrl = await uploadBuffer(buffer, fileName, file.type)

    console.log(`✅ ${type} video uploaded: ${videoUrl}`)

    // Update organization settings
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

    const currentVideoSettings = existingSettings.videoSettings || {}
    
    const updatedVideoSettings = {
      ...currentVideoSettings,
      ...(type === 'intro' ? {
        introVideoUrl: videoUrl,
        introImageUrl: undefined, // Clear AI generation data
        introPrompt: undefined,
      } : {
        outroVideoUrl: videoUrl,
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
      videoUrl,
      type,
    })

  } catch (error) {
    console.error('Error uploading video:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload video', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

