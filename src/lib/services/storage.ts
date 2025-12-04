import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

/**
 * Get or create S3 client for Cloudflare R2
 * 
 * Required environment variables:
 * - R2_ENDPOINT: https://<account_id>.r2.cloudflarestorage.com
 * - R2_ACCESS_KEY_ID: Access key from R2 API token
 * - R2_SECRET_ACCESS_KEY: Secret key from R2 API token
 * - R2_BUCKET: Bucket name (e.g., sudouest-podcaster)
 * - R2_PUBLIC_URL: Public URL (e.g., https://pub-xxx.r2.dev)
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 configuration missing. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY')
    }
    
    s3Client = new S3Client({
      endpoint,
      region: 'auto', // R2 uses 'auto'
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }
  
  return s3Client
}

/**
 * Get the bucket name from environment
 */
function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET
  if (!bucketName) {
    throw new Error('R2_BUCKET environment variable not set')
  }
  return bucketName
}

/**
 * Get the public URL for a file in R2
 * Files uploaded to R2 are publicly accessible via the public URL
 */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable not set')
  }
  return `${publicUrl}/${key}`
}

/**
 * Upload a file from a URL to R2 bucket
 * Downloads the file and uploads it to Cloudflare R2
 * Returns the public URL (accessible by anyone, including fal.ai)
 */
export async function uploadFromUrl(
  sourceUrl: string,
  destinationKey: string,
  contentType?: string
): Promise<string> {
  console.log(`📥 Downloading from: ${sourceUrl}`)
  
  // Download the file
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download from ${sourceUrl}: ${response.status}`)
  }
  
  const buffer = Buffer.from(await response.arrayBuffer())
  console.log(`📦 Downloaded ${buffer.length} bytes`)
  
  // Upload to R2
  const client = getS3Client()
  const bucketName = getBucketName()
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: destinationKey,
    Body: buffer,
    ContentType: contentType || getContentTypeFromKey(destinationKey),
  })
  
  await client.send(command)
  
  // Return public URL (R2 public URLs work everywhere!)
  const publicUrl = getPublicUrl(destinationKey)
  
  console.log(`✅ Uploaded to R2: ${publicUrl}`)
  
  return publicUrl
}

/**
 * Upload audio file from fal.ai to R2
 * Returns public URL (accessible by fal.ai for video generation)
 */
export async function uploadAudioToBucket(
  falUrl: string,
  jobId: string,
  chunkIndex: number
): Promise<string> {
  const key = `audio/${jobId}/chunk-${chunkIndex}.mp3`
  return uploadFromUrl(falUrl, key, 'audio/mpeg')
}

/**
 * Upload video file from fal.ai to R2
 */
export async function uploadVideoToBucket(
  falUrl: string,
  jobId: string
): Promise<string> {
  const key = `videos/${jobId}.mp4`
  return uploadFromUrl(falUrl, key, 'video/mp4')
}

/**
 * Upload final podcast video to R2
 */
export async function uploadFinalPodcastToBucket(
  localPath: string,
  podcastId: number
): Promise<string> {
  const fs = await import('fs/promises')
  const buffer = await fs.readFile(localPath)
  
  const client = getS3Client()
  const bucketName = getBucketName()
  const key = `podcasts/${podcastId}/final.mp4`
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  })
  
  await client.send(command)
  
  // Return public URL
  const publicUrl = getPublicUrl(key)
  
  console.log(`✅ Final podcast uploaded: ${publicUrl}`)
  
  return publicUrl
}

/**
 * Upload a buffer directly to R2
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client()
  const bucketName = getBucketName()
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })
  
  await client.send(command)
  
  const publicUrl = getPublicUrl(key)
  console.log(`✅ Uploaded to R2: ${publicUrl}`)
  
  return publicUrl
}

/**
 * Check if R2 storage is configured
 */
export function isBucketConfigured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  )
}

/**
 * Get content type from file extension
 */
function getContentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase()
  
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
    default:
      return 'application/octet-stream'
  }
}

