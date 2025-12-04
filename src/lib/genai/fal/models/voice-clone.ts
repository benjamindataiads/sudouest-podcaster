/**
 * Minimax Voice Clone Model Configuration
 * 
 * Model: fal-ai/minimax/voice-clone
 * Use case: Clone a reference voice and generate speech from text
 */

import { submitToFal } from '../client'
import type { AudioGenerationInput } from '../../types'

// ============================================
// Model Configuration
// ============================================

export const VOICE_CLONE_MODEL = 'fal-ai/minimax/voice-clone'

export const VOICE_CLONE_DEFAULTS = {
  model: 'speech-02-hd',
  noise_reduction: true,
  need_volume_normalization: true,
}

// Default voice URL (Sud-Ouest presenter)
export const DEFAULT_VOICE_URL = 'https://dataiads-test1.fr/sudouest/voix.mp3'

// ============================================
// Input/Output Types (fal.ai specific)
// ============================================

interface VoiceCloneInput {
  audio_url: string      // Reference voice URL for cloning
  text: string           // Text to synthesize
  model?: string         // Model version
  noise_reduction?: boolean
  need_volume_normalization?: boolean
}

interface VoiceCloneOutput {
  audio: {
    url: string
  }
}

// ============================================
// API Functions
// ============================================

/**
 * Submit a voice clone job to fal.ai
 * Returns immediately with request_id - result will come via webhook
 */
export async function submitVoiceClone(input: AudioGenerationInput): Promise<{ requestId: string }> {
  const falInput: VoiceCloneInput = {
    audio_url: input.voiceUrl || DEFAULT_VOICE_URL,
    text: input.text,
    ...VOICE_CLONE_DEFAULTS,
  }
  
  console.log(`🎤 Submitting voice clone: ${input.text.substring(0, 50)}...`)
  console.log(`   Voice URL: ${falInput.audio_url}`)
  
  const response = await submitToFal({
    model: VOICE_CLONE_MODEL,
    input: falInput,
    useWebhook: true,
  })
  
  return { requestId: response.request_id }
}

/**
 * Submit multiple voice clone jobs in parallel
 * Returns array of request IDs
 */
export async function submitVoiceCloneBatch(
  inputs: AudioGenerationInput[]
): Promise<{ requestIds: string[] }> {
  console.log(`🎤 Submitting ${inputs.length} voice clone jobs in parallel...`)
  
  const promises = inputs.map(input => submitVoiceClone(input))
  const results = await Promise.all(promises)
  
  const requestIds = results.map(r => r.requestId)
  console.log(`✅ Submitted ${requestIds.length} voice clone jobs`)
  
  return { requestIds }
}

/**
 * Parse webhook result for voice clone
 */
export function parseVoiceCloneResult(payload: VoiceCloneOutput): { audioUrl: string } {
  if (!payload?.audio?.url) {
    throw new Error('Invalid voice clone result: missing audio URL')
  }
  return { audioUrl: payload.audio.url }
}

