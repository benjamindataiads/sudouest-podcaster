/**
 * Kling AI Avatar Video Model Configuration
 * 
 * Model: fal-ai/kling-video/v1/standard/ai-avatar
 * Use case: Generate lip-sync video from audio and avatar image
 */

import { submitToFal } from '../client'
import type { VideoGenerationInput } from '../../types'

// ============================================
// Model Configuration
// ============================================

export const AVATAR_VIDEO_MODEL = 'fal-ai/kling-video/v1/standard/ai-avatar'

// Default avatar image URL (Sud-Ouest presenter)
export const DEFAULT_AVATAR_IMAGE_URL = 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png'

// ============================================
// Input/Output Types (fal.ai specific)
// ============================================

interface AvatarVideoInput {
  image_url: string      // Avatar image URL
  audio_url: string      // Audio to lip-sync
  prompt?: string        // Additional prompt (optional)
}

interface AvatarVideoOutput {
  video: {
    url: string
  }
  duration?: number
}

// ============================================
// API Functions
// ============================================

/**
 * Submit an avatar video generation job to fal.ai
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
  
  const falInput: AvatarVideoInput = {
    audio_url: input.audioUrl,
    image_url: imageUrl,
    prompt: 'Animate only the person for lip sync. Keep all logos, text, and background elements completely static and unchanged. Natural subtle hand movements while speaking. Do not add, remove, or animate any logos or graphics. Preserve the original image composition.',
  }
  
  console.log(`🎬 Submitting avatar video:`)
  console.log(`   Audio: ${input.audioUrl}`)
  console.log(`   Image: ${imageUrl}`)
  
  const response = await submitToFal({
    model: AVATAR_VIDEO_MODEL,
    input: falInput,
    useWebhook: true,
  })
  
  return { requestId: response.request_id }
}

/**
 * Submit multiple avatar video jobs in parallel
 * Returns array of request IDs
 */
export async function submitAvatarVideoBatch(
  inputs: VideoGenerationInput[]
): Promise<{ requestIds: string[] }> {
  console.log(`🎬 Submitting ${inputs.length} avatar video jobs in parallel...`)
  
  const promises = inputs.map(input => submitAvatarVideo(input))
  const results = await Promise.all(promises)
  
  const requestIds = results.map(r => r.requestId)
  console.log(`✅ Submitted ${requestIds.length} avatar video jobs`)
  
  return { requestIds }
}

/**
 * Parse webhook result for avatar video
 */
export function parseAvatarVideoResult(payload: AvatarVideoOutput): { 
  videoUrl: string
  duration?: number 
} {
  if (!payload?.video?.url) {
    throw new Error('Invalid avatar video result: missing video URL')
  }
  return { 
    videoUrl: payload.video.url,
    duration: payload.duration,
  }
}

