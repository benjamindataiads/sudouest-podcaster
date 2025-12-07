import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes timeout

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

interface ChatterboxInput {
  text: string
  voice: string
  custom_audio_language?: string
  exaggeration?: number
  temperature?: number
  cfg_scale?: number
}

interface ChatterboxOutput {
  audio: {
    url: string
    content_type?: string
    file_size?: number
  }
}

/**
 * POST /api/audio-article/generate-audio
 * Generate audio using Fal.ai Chatterbox TTS
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { text, voice = 'french' } = body

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
    }

    // Chatterbox has a 300 character limit per request
    // Split text into chunks if needed
    const MAX_CHARS = 290 // Leave some margin
    const chunks = splitTextIntoChunks(text, MAX_CHARS)

    console.log(`🎤 Generating audio: ${text.length} chars, ${chunks.length} chunk(s), voice: ${voice}`)

    const audioUrls: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      console.log(`  Processing chunk ${i + 1}/${chunks.length}: ${chunks[i].length} chars`)
      
      const input: ChatterboxInput = {
        text: chunks[i],
        voice: voice,
        exaggeration: 0.5,
        temperature: 0.8,
        cfg_scale: 0.5,
      }

      const result = await fal.subscribe('fal-ai/chatterbox/text-to-speech/multilingual', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log(`    Chunk ${i + 1}: ${update.status}`)
          }
        },
      }) as ChatterboxOutput

      if (result.audio?.url) {
        audioUrls.push(result.audio.url)
        console.log(`  ✅ Chunk ${i + 1} completed: ${result.audio.url}`)
      }
    }

    if (audioUrls.length === 0) {
      throw new Error('Aucun audio généré')
    }

    // If multiple chunks, we would need to concatenate them
    // For now, return the first one or concatenate server-side
    let finalAudioUrl = audioUrls[0]
    
    if (audioUrls.length > 1) {
      // Concatenate audio files
      console.log(`🔗 Concatenating ${audioUrls.length} audio chunks...`)
      const concatResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/audio/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls }),
      })
      
      if (concatResponse.ok) {
        const concatData = await concatResponse.json()
        finalAudioUrl = concatData.audioUrl
        console.log(`✅ Audio concatenated: ${finalAudioUrl}`)
      } else {
        console.warn('⚠️ Concatenation failed, using first chunk')
      }
    }

    console.log(`✅ Audio generation complete: ${finalAudioUrl}`)

    return NextResponse.json({
      audioUrl: finalAudioUrl,
      chunks: audioUrls.length,
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

/**
 * Split text into chunks that respect sentence boundaries
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxChars) {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      
      // If single sentence is too long, split by words
      if (sentence.length > maxChars) {
        const words = sentence.split(' ')
        currentChunk = ''
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxChars) {
            currentChunk += (currentChunk ? ' ' : '') + word
          } else {
            if (currentChunk) chunks.push(currentChunk.trim())
            currentChunk = word
          }
        }
      } else {
        currentChunk = sentence
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

