import { NextRequest, NextResponse } from 'next/server'
import { uploadBuffer, isBucketConfigured } from '@/lib/services/storage'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

/**
 * Convert audio file to MP3 using ffmpeg
 */
async function convertToMp3(inputBuffer: Buffer, inputFormat: string): Promise<Buffer> {
  const tempDir = os.tmpdir()
  const inputPath = path.join(tempDir, `input-${Date.now()}.${inputFormat}`)
  const outputPath = path.join(tempDir, `output-${Date.now()}.mp3`)
  
  try {
    // Write input file
    await fs.writeFile(inputPath, inputBuffer)
    
    // Convert to MP3 with ffmpeg
    console.log(`🔄 Converting ${inputFormat} to MP3...`)
    await execAsync(`ffmpeg -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`)
    
    // Read output file
    const mp3Buffer = await fs.readFile(outputPath)
    console.log(`✅ Conversion complete: ${mp3Buffer.length} bytes`)
    
    return mp3Buffer
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputPath).catch(() => {})
      await fs.unlink(outputPath).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
  }
}

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
    
    // Validate file type (accept audio/mpeg, audio/webm, audio/wav, etc.)
    if (type === 'voice' && !file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Voice file must be an audio file (MP3, WAV, WebM)' }, { status: 400 })
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
    const randomId = Math.random().toString(36).substring(7)
    
    let buffer: Buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type
    let finalExtension: string
    
    // For voice files, convert to MP3 if not already MP3
    if (type === 'voice') {
      const isWebm = file.type.includes('webm') || file.name.endsWith('.webm')
      const isWav = file.type.includes('wav') || file.name.endsWith('.wav')
      const isOgg = file.type.includes('ogg') || file.name.endsWith('.ogg')
      const isMp3 = file.type.includes('mpeg') || file.type.includes('mp3') || file.name.endsWith('.mp3')
      
      if (!isMp3 && (isWebm || isWav || isOgg)) {
        console.log(`🎵 Audio format detected: ${file.type}, converting to MP3...`)
        const inputFormat = isWebm ? 'webm' : isWav ? 'wav' : 'ogg'
        const convertedBuffer = await convertToMp3(buffer, inputFormat)
        buffer = Buffer.from(convertedBuffer)
        contentType = 'audio/mpeg'
      }
      finalExtension = 'mp3'
    } else {
      finalExtension = file.name.split('.').pop() || 'png'
    }
    
    const key = `avatars/${type}s/${timestamp}-${randomId}.${finalExtension}`
    
    console.log(`📤 Uploading ${type} to R2: ${key}`)
    
    // Upload to R2
    const publicUrl = await uploadBuffer(buffer, key, contentType)
    
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
