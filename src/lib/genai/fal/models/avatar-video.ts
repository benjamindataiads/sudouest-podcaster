/**
 * VEED Fabric 1.0 Fast - Lip-sync Video Model
 * 
 * Model: veed/fabric-1.0/fast
 * Use case: Generate lip-sync video from audio and avatar image
 * 
 * Input:
 *   - image_url: Avatar image URL
 *   - audio_url: Audio to lip-sync  
 *   - resolution: "720p" or "480p"
 * 
 * Output:
 *   - video: { url: string }
 */

import { submitToFal } from '../client'
import type { VideoGenerationInput } from '../../types'

// ============================================
// Model Configuration
// ============================================

export const AVATAR_VIDEO_MODEL = 'veed/fabric-1.0/fast'

// Default avatar image URL (Sud-Ouest presenter)
export const DEFAULT_AVATAR_IMAGE_URL = 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png'

// ============================================
// Input/Output Types (fal.ai specific)
// ============================================

interface FabricVideoInput {
  image_url: string      // Avatar image URL
  audio_url: string      // Audio to lip-sync
  resolution: '720p' | '480p'  // Video resolution
}

interface FabricVideoOutput {
  video: {
    url: string
    content_type?: string
    file_name?: string
    file_size?: number
  }
}

// ============================================
// API Functions
// ============================================

/**
 * Submit a lip-sync video generation job to fal.ai (VEED Fabric)
 * Returns immediately with request_id - result will come via webhook
 */
export async function submitAvatarVideo(input: VideoGenerationInput): Promise<{ requestId: string }> {
  // Validate URLs
  if (!input.audioUrl || !input.audioUrl.startsWith('http')) {
    throw new Error(`Invalid audio URL: ${input.audioUrl}`)
  }
  
  const imageUrl = input.imageUrl || DEFAULT_AVATAR_IMAGE_URL
  if (!imageUrl.startsWith('http')) {
    throw new Error(`Invalid image URL: ${imageUrl}`)
  }
  
  const falInput: FabricVideoInput = {
    audio_url: input.audioUrl,
    image_url: imageUrl,
    resolution: '720p',
  }
  
  console.log(`🎬 Submitting lip-sync video (VEED Fabric):`)
  console.log(`   Audio: ${input.audioUrl}`)
  console.log(`   Image: ${imageUrl}`)
  console.log(`   Resolution: 720p`)
  
  const response = await submitToFal({
    model: AVATAR_VIDEO_MODEL,
    input: falInput,
    useWebhook: true,
  })
  
  return { requestId: response.request_id }
}

/**
 * Submit multiple video jobs in parallel
 * Returns array of request IDs
 */
export async function submitAvatarVideoBatch(
  inputs: VideoGenerationInput[]
): Promise<{ requestIds: string[] }> {
  console.log(`🎬 Submitting ${inputs.length} lip-sync video jobs in parallel...`)
  
  const promises = inputs.map(input => submitAvatarVideo(input))
  const results = await Promise.all(promises)
  
  const requestIds = results.map(r => r.requestId)
  console.log(`✅ Submitted ${requestIds.length} video jobs`)
  
  return { requestIds }
}

/**
 * Parse webhook result for VEED Fabric video
 */
export function parseAvatarVideoResult(payload: FabricVideoOutput): { 
  videoUrl: string
} {
  if (!payload?.video?.url) {
    throw new Error('Invalid video result: missing video URL')
  }
  return { 
    videoUrl: payload.video.url,
  }
}
