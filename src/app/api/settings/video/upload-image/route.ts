import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadBuffer, isBucketConfigured } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/video/upload-image
 * Upload image for intro/outro AI generation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are supported.' },
        { status: 400 }
      )
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    console.log(`📤 Uploading image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

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
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `intro-outro-images/${orgId}/source_${timestamp}.${ext}`

    const imageUrl = await uploadBuffer(buffer, fileName, file.type)

    console.log(`✅ Image uploaded: ${imageUrl}`)

    return NextResponse.json({
      success: true,
      url: imageUrl,
    })

  } catch (error) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload image', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

