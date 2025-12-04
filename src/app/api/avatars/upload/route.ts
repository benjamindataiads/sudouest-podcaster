import { NextRequest, NextResponse } from 'next/server'
import { uploadBuffer, isBucketConfigured } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avatars/upload
 * Check if R2 is configured
 */
export async function GET() {
  return NextResponse.json({
    configured: isBucketConfigured(),
    r2Endpoint: process.env.R2_ENDPOINT ? 'set' : 'missing',
    r2Bucket: process.env.R2_BUCKET ? 'set' : 'missing',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ? 'set' : 'missing',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ? 'set' : 'missing',
    r2PublicUrl: process.env.R2_PUBLIC_URL ? 'set' : 'missing',
  })
}

/**
 * POST /api/avatars/upload
 * Upload avatar files (voice MP3 or image) to Cloudflare R2
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null // 'voice' or 'image'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    if (!type || !['voice', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "voice" or "image"' }, { status: 400 })
    }
    
    // Validate file type
    if (type === 'voice' && !file.type.includes('audio')) {
      return NextResponse.json({ error: 'Voice file must be an audio file (MP3)' }, { status: 400 })
    }
    
    if (type === 'image' && !file.type.includes('image')) {
      return NextResponse.json({ error: 'Image file must be an image (PNG, JPG)' }, { status: 400 })
    }
    
    // Check if R2 is configured
    if (!isBucketConfigured()) {
      return NextResponse.json(
        { 
          error: 'R2 storage not configured',
          missing: {
            R2_ENDPOINT: !process.env.R2_ENDPOINT,
            R2_BUCKET: !process.env.R2_BUCKET,
            R2_ACCESS_KEY_ID: !process.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: !process.env.R2_SECRET_ACCESS_KEY,
            R2_PUBLIC_URL: !process.env.R2_PUBLIC_URL,
          }
        },
        { status: 500 }
      )
    }
    
    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || (type === 'voice' ? 'mp3' : 'png')
    const key = `avatars/${type}s/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`
    
    console.log(`📤 Uploading ${type} to R2: ${key}`)
    
    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const publicUrl = await uploadBuffer(buffer, key, file.type)
    
    console.log(`✅ Uploaded avatar ${type}: ${publicUrl}`)
    
    return NextResponse.json({
      success: true,
      url: publicUrl, // Public R2 URL (works for frontend AND fal.ai)
      type,
      filename: file.name,
    })
  } catch (error) {
    console.error('Error uploading avatar file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
