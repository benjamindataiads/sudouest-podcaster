import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout for video assembly
import { auth } from '@clerk/nextjs/server'
import { concatenateVideos } from '@/lib/services/video-processor'
import { uploadFinalPodcastToBucket, isBucketConfigured } from '@/lib/services/storage'
import path from 'path'
import fs from 'fs/promises'

/**
 * POST /api/video/assemble
 * Assemble plusieurs vidéos en une seule avec ffmpeg
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { videoUrls, withCaptions = false, podcastId } = body

    console.log('📦 Assemble request received:', { videoUrlsCount: videoUrls?.length, withCaptions, podcastId, userId, orgId })

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'Liste de vidéos requise' },
        { status: 400 }
      )
    }

    console.log(`Assembling ${videoUrls.length} video chunks:`)
    videoUrls.forEach((url, idx) => console.log(`  ${idx + 1}. ${url}`))

    // Concaténer les vidéos
    const concatenatedPath = await concatenateVideos(videoUrls)
    
    console.log('✅ Videos concatenated successfully:', concatenatedPath)

    let finalVideoUrl: string

    // Always upload to R2 if configured (local paths don't work in Railway/production)
    const bucketConfigured = isBucketConfigured()
    console.log(`📦 Bucket configured: ${bucketConfigured}, podcastId: ${podcastId}`)
    
    if (bucketConfigured) {
      try {
        console.log('📤 Uploading final video to R2...')
        // Use podcastId or generate a unique ID
        const uploadId = podcastId || Date.now()
        finalVideoUrl = await uploadFinalPodcastToBucket(concatenatedPath, uploadId)
        console.log(`✅ Uploaded to R2: ${finalVideoUrl}`)
        
        // Clean up local file
        await fs.unlink(concatenatedPath).catch(() => {})
      } catch (uploadError) {
        console.error('⚠️ R2 upload failed:', uploadError)
        // In production, we can't use local paths - throw error
        throw new Error(`Upload R2 failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`)
      }
    } else {
      // Local dev fallback
      console.log('⚠️ R2 not configured, using local path (dev only)')
      finalVideoUrl = concatenatedPath.replace(path.join(process.cwd(), 'public'), '')
    }

    // Sauvegarder dans le podcast si podcastId fourni
    if (podcastId) {
      const { db, podcasts } = await import('@/lib/db')
      const { eq } = await import('drizzle-orm')
      
      // First check if podcast exists
      const [existing] = await db.select().from(podcasts).where(eq(podcasts.id, podcastId)).limit(1)
      
      if (!existing) {
        console.warn(`⚠️ Podcast ${podcastId} not found, skipping update`)
      } else {
        // Update with orgId claim if needed
        const updateData: Record<string, unknown> = {
          finalVideoUrl: finalVideoUrl,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }
        
        // Claim for current org/user if not set
        if (!existing.orgId && orgId) {
          updateData.orgId = orgId
        }
        if (!existing.userId && userId) {
          updateData.userId = userId
        }
        
        await db.update(podcasts)
          .set(updateData)
          .where(eq(podcasts.id, podcastId))
        
        console.log(`✅ Podcast ${podcastId} updated with final video: ${finalVideoUrl}`)
      }
    }

    return NextResponse.json({
      videoUrl: finalVideoUrl,
      chunksAssembled: videoUrls.length,
    })
  } catch (error) {
    console.error('❌ Error assembling videos:', error)
    
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'assemblage des vidéos',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

