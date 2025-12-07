import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // 3 minutes timeout for parallel generation + merge

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

// Fixed seed for consistent voice generation
const CHATTERBOX_SEED = 29994

interface ChatterboxInput {
  text: string
  voice: string
  custom_audio_language?: string
  exaggeration?: number
  temperature?: number
  cfg_scale?: number
  seed?: number
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
 * - Chunks text into segments ≤300 chars
 * - Generates all chunks IN PARALLEL with seed 29994
 * - Merges audio files into one
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
    const MAX_CHARS = 295 // Leave margin for safety
    const chunks = splitTextIntoChunks(text, MAX_CHARS)

    console.log(`🎤 Generating audio: ${text.length} chars, ${chunks.length} chunk(s), voice: ${voice}, seed: ${CHATTERBOX_SEED}`)
    chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: ${chunk.length} chars`))

    // Generate all chunks IN PARALLEL
    console.log(`⚡ Starting parallel generation of ${chunks.length} chunks...`)
    
    const generateChunk = async (chunkText: string, index: number): Promise<{ index: number; url: string | null }> => {
      try {
        console.log(`  🔊 Chunk ${index + 1}/${chunks.length} starting...`)
        
        const input: ChatterboxInput = {
          text: chunkText,
          voice: voice,
          exaggeration: 0.5,
          temperature: 0.8,
          cfg_scale: 0.5,
          seed: CHATTERBOX_SEED, // Fixed seed for consistency
        }

        const result = await fal.subscribe('fal-ai/chatterbox/text-to-speech/multilingual', {
          input,
          logs: false,
        }) as ChatterboxOutput

        if (result.audio?.url) {
          console.log(`  ✅ Chunk ${index + 1} completed`)
          return { index, url: result.audio.url }
        }
        
        console.warn(`  ⚠️ Chunk ${index + 1} returned no audio`)
        return { index, url: null }
      } catch (error) {
        console.error(`  ❌ Chunk ${index + 1} failed:`, error)
        return { index, url: null }
      }
    }

    // Run all generations in parallel
    const results = await Promise.all(
      chunks.map((chunk, index) => generateChunk(chunk, index))
    )

    // Sort by index to maintain order
    results.sort((a, b) => a.index - b.index)
    
    // Filter successful results
    const audioUrls = results
      .filter(r => r.url !== null)
      .map(r => r.url as string)

    if (audioUrls.length === 0) {
      throw new Error('Aucun audio généré')
    }

    console.log(`✅ ${audioUrls.length}/${chunks.length} chunks generated successfully`)

    // Merge audio files if multiple chunks
    let finalAudioUrl = audioUrls[0]
    
    if (audioUrls.length > 1) {
      console.log(`🔗 Merging ${audioUrls.length} audio chunks...`)
      
      // Use internal merge API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const mergeUrl = baseUrl.startsWith('http') ? `${baseUrl}/api/audio/merge` : `https://${baseUrl}/api/audio/merge`
      
      const concatResponse = await fetch(mergeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls }),
      })
      
      if (concatResponse.ok) {
        const concatData = await concatResponse.json()
        finalAudioUrl = concatData.audioUrl
        console.log(`✅ Audio merged: ${finalAudioUrl}`)
      } else {
        const errorText = await concatResponse.text()
        console.error('⚠️ Merge failed:', errorText)
        // Fallback: return first chunk
        console.log('⚠️ Using first chunk as fallback')
      }
    }

    console.log(`🎉 Audio generation complete: ${finalAudioUrl}`)

    return NextResponse.json({
      audioUrl: finalAudioUrl,
      chunks: audioUrls.length,
      totalChunks: chunks.length,
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

