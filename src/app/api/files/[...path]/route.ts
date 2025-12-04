import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'

/**
 * GET /api/files/[...path]
 * Proxy endpoint to serve files from Railway bucket with proper CORS
 * Example: /api/files/avatars/images/123.png
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/')
    
    if (!filePath) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 })
    }

    // Get bucket config
    const endpoint = process.env.ENDPOINT || process.env.BUCKET_ENDPOINT
    const bucketName = process.env.BUCKET || process.env.BUCKET_NAME
    const accessKeyId = process.env.ACCESS_KEY_ID || process.env.BUCKET_ACCESS_KEY_ID
    const secretAccessKey = process.env.SECRET_ACCESS_KEY || process.env.BUCKET_SECRET_ACCESS_KEY

    if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'Bucket not configured' }, { status: 500 })
    }

    // Create S3 client
    const s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })

    // Fetch from bucket
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    })

    const response = await s3Client.send(command)
    
    if (!response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const reader = response.Body.transformToWebStream().getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    const buffer = Buffer.concat(chunks)

    // Determine content type
    const contentType = response.ContentType || getContentType(filePath)

    // Return with proper CORS headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    
    // Check if it's a "not found" error
    if (String(error).includes('NoSuchKey') || String(error).includes('NotFound')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Failed to serve file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'mp4':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'wav':
      return 'audio/wav'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

