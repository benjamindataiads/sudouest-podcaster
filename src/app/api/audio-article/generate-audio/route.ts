import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as fal from '@fal-ai/serverless-client'
import { uploadBuffer } from '@/lib/services/storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes timeout

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

// MiniMax Speech 2.5 Turbo configuration
const MINIMAX_MODEL = 'fal-ai/minimax/preview/speech-2.5-turbo'

interface MinimaxInput {
  text: string
  voice_setting: {
    voice_id: string
    speed?: number
    vol?: number
    pitch?: number
    emotion?: string
  }
  language_boost?: string
  audio_setting?: {
    format?: string
    sample_rate?: number
    bitrate?: number
  }
}

interface MinimaxOutput {
  audio: {
    url: string
    content_type?: string
    file_size?: number
  }
  duration_ms?: number
}

/**
 * POST /api/audio-article/generate-audio
 * Generate audio using Fal.ai MiniMax Speech 2.5 Turbo
 * - Supports up to 5000 characters (no chunking needed for most summaries)
 * - French language boost
 * - Selectable voice ID
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { text, voiceId = 'Wise_Woman' } = body

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
    }

    // MiniMax supports up to 5000 characters
    if (text.length > 5000) {
      return NextResponse.json({ 
        error: 'Le texte dépasse la limite de 5000 caractères',
        length: text.length,
        max: 5000
      }, { status: 400 })
    }

    console.log(`🎤 Generating audio with MiniMax: ${text.length} chars, voice: ${voiceId}`)

    const input: MinimaxInput = {
      text: text,
      voice_setting: {
        voice_id: voiceId,
        speed: 1.1,
        vol: 1,
        pitch: 0,
        emotion: 'neutral',
      },
      language_boost: 'French', // Always French for better pronunciation
      audio_setting: {
        format: 'mp3',
        sample_rate: 32000,
        bitrate: 128000,
      },
    }

    const result = await fal.subscribe(MINIMAX_MODEL, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`  ⏳ MiniMax: ${update.status}`)
        }
      },
    }) as MinimaxOutput

    if (!result.audio?.url) {
      throw new Error('MiniMax n\'a pas retourné d\'audio')
    }

    console.log(`✅ Audio generated: ${result.audio.url} (${result.duration_ms}ms)`)

    // Download and upload to R2 for permanent storage
    console.log('📤 Uploading to R2...')
    const audioResponse = await fetch(result.audio.url)
    const buffer = Buffer.from(await audioResponse.arrayBuffer())
    
    const key = `audio-articles/${Date.now()}_${voiceId}.mp3`
    const finalAudioUrl = await uploadBuffer(buffer, key, 'audio/mpeg')
    
    console.log(`🎉 Audio uploaded: ${finalAudioUrl}`)

    return NextResponse.json({
      audioUrl: finalAudioUrl,
      durationMs: result.duration_ms,
      voiceId: voiceId,
    })
  } catch (error) {
    console.error('Error generating audio:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération audio',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
