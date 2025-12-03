import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

/**
 * Get or create S3 client for bucket operations
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.BUCKET_ENDPOINT
    const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID
    const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY
    
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('Bucket configuration missing. Set BUCKET_ENDPOINT, BUCKET_ACCESS_KEY_ID, and BUCKET_SECRET_ACCESS_KEY')
    }
    
    s3Client = new S3Client({
      endpoint,
      region: 'auto', // Tigris/R2 use 'auto'
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for some S3-compatible services
    })
  }
  
  return s3Client
}

/**
 * Get the bucket name from environment
 */
function getBucketName(): string {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable not set')
  }
  return bucketName
}

/**
 * Upload a file from a URL to the bucket
 * Downloads the file and uploads it to S3-compatible storage
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
  
  // Upload to bucket
  const client = getS3Client()
  const bucketName = getBucketName()
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: destinationKey,
    Body: buffer,
    ContentType: contentType || getContentTypeFromKey(destinationKey),
  })
  
  await client.send(command)
  
  // Construct the public URL
  const endpoint = process.env.BUCKET_ENDPOINT!
  const publicUrl = `${endpoint}/${bucketName}/${destinationKey}`
  
  console.log(`✅ Uploaded to bucket: ${publicUrl}`)
  
  return publicUrl
}

/**
 * Upload audio file from fal.ai to bucket
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
 * Upload video file from fal.ai to bucket
 */
export async function uploadVideoToBucket(
  falUrl: string,
  jobId: string
): Promise<string> {
  const key = `videos/${jobId}.mp4`
  return uploadFromUrl(falUrl, key, 'video/mp4')
}

/**
 * Upload final podcast video to bucket
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
  
  const endpoint = process.env.BUCKET_ENDPOINT!
  const publicUrl = `${endpoint}/${bucketName}/${key}`
  
  console.log(`✅ Final podcast uploaded: ${publicUrl}`)
  
  return publicUrl
}

/**
 * Check if bucket storage is configured
 */
export function isBucketConfigured(): boolean {
  return !!(
    process.env.BUCKET_ENDPOINT &&
    process.env.BUCKET_ACCESS_KEY_ID &&
    process.env.BUCKET_SECRET_ACCESS_KEY &&
    process.env.BUCKET_NAME
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

