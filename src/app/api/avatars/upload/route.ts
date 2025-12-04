import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avatars/upload
 * Check if bucket is configured
 */
export async function GET() {
  const bucketEndpoint = process.env.ENDPOINT || process.env.BUCKET_ENDPOINT
  const bucketName = process.env.BUCKET || process.env.BUCKET_NAME
  const accessKeyId = process.env.ACCESS_KEY_ID || process.env.BUCKET_ACCESS_KEY_ID
  const secretAccessKey = process.env.SECRET_ACCESS_KEY || process.env.BUCKET_SECRET_ACCESS_KEY
  
  return NextResponse.json({
    configured: !!(bucketEndpoint && bucketName && accessKeyId && secretAccessKey),
    endpoint: bucketEndpoint ? 'set' : 'missing',
    bucketName: bucketName ? 'set' : 'missing',
    accessKeyId: accessKeyId ? 'set' : 'missing',
    secretAccessKey: secretAccessKey ? 'set' : 'missing',
  })
}

/**
 * POST /api/avatars/upload
 * Upload avatar files (voice MP3 or image) to bucket
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
    
    // Check if bucket is configured (Railway uses ENDPOINT, BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY)
    const bucketEndpoint = process.env.ENDPOINT || process.env.BUCKET_ENDPOINT
    const bucketName = process.env.BUCKET || process.env.BUCKET_NAME
    const accessKeyId = process.env.ACCESS_KEY_ID || process.env.BUCKET_ACCESS_KEY_ID
    const secretAccessKey = process.env.SECRET_ACCESS_KEY || process.env.BUCKET_SECRET_ACCESS_KEY
    
    console.log('Bucket config:', {
      endpoint: bucketEndpoint ? 'set' : 'missing',
      bucketName: bucketName ? 'set' : 'missing',
      accessKeyId: accessKeyId ? 'set' : 'missing',
      secretAccessKey: secretAccessKey ? 'set' : 'missing',
    })
    
    if (!bucketEndpoint || !bucketName || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { 
          error: 'Bucket storage not configured',
          missing: {
            ENDPOINT: !bucketEndpoint,
            BUCKET: !bucketName,
            ACCESS_KEY_ID: !accessKeyId,
            SECRET_ACCESS_KEY: !secretAccessKey,
          }
        },
        { status: 500 }
      )
    }
    
    // Create S3 client for Railway storage
    console.log(`🔧 Creating S3 client with endpoint: ${bucketEndpoint}`)
    const s3Client = new S3Client({
      endpoint: bucketEndpoint,
      region: 'us-east-1', // Railway uses us-east-1
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // Try path-style first
    })
    
    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || (type === 'voice' ? 'mp3' : 'png')
    const key = `avatars/${type}s/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`
    
    console.log(`📤 Uploading ${type} to bucket: ${bucketName}/${key}`)
    
    // Upload to bucket
    const buffer = Buffer.from(await file.arrayBuffer())
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read', // Make file publicly accessible
      }))
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error)
      // If ACL fails, try without it
      if (String(s3Error).includes('ACL')) {
        console.log('Retrying without ACL...')
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        }))
      } else {
        throw s3Error
      }
    }
    
    // Construct public URL for Railway storage
    // Format: https://{bucket-name}.storage.railway.app/{key}
    const publicUrl = `https://${bucketName}.storage.railway.app/${key}`
    
    console.log(`✅ Uploaded avatar ${type}: ${publicUrl}`)
    
    return NextResponse.json({
      success: true,
      url: publicUrl,
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

