import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as fal from '@fal-ai/serverless-client'
import { uploadBuffer } from '@/lib/services/storage'

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
 * - Merges audio files into one (WAV concatenation)
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
    
    const generateChunk = async (chunkText: string, index: number): Promise<{ index: number; url: string | null; buffer: Buffer | null }> => {
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
          console.log(`  ✅ Chunk ${index + 1} completed, downloading...`)
          // Download the audio buffer immediately for merging
          const audioResponse = await fetch(result.audio.url)
          const buffer = Buffer.from(await audioResponse.arrayBuffer())
          return { index, url: result.audio.url, buffer }
        }
        
        console.warn(`  ⚠️ Chunk ${index + 1} returned no audio`)
        return { index, url: null, buffer: null }
      } catch (error) {
        console.error(`  ❌ Chunk ${index + 1} failed:`, error)
        return { index, url: null, buffer: null }
      }
    }

    // Run all generations in parallel
    const results = await Promise.all(
      chunks.map((chunk, index) => generateChunk(chunk, index))
    )

    // Sort by index to maintain order
    results.sort((a, b) => a.index - b.index)
    
    // Filter successful results
    const successfulResults = results.filter(r => r.buffer !== null)

    if (successfulResults.length === 0) {
      throw new Error('Aucun audio généré')
    }

    console.log(`✅ ${successfulResults.length}/${chunks.length} chunks generated successfully`)

    let finalAudioUrl: string

    if (successfulResults.length === 1) {
      // Only one chunk, use its URL directly
      finalAudioUrl = successfulResults[0].url!
    } else {
      // Multiple chunks: merge WAV files
      console.log(`🔗 Merging ${successfulResults.length} WAV audio chunks...`)
      
      const buffers = successfulResults.map(r => r.buffer!)
      const mergedBuffer = mergeWavBuffers(buffers)
      
      // Upload merged audio to R2
      console.log('📤 Uploading merged audio to R2...')
      const key = `audio-articles/merged_${Date.now()}.wav`
      finalAudioUrl = await uploadBuffer(mergedBuffer, key, 'audio/wav')
      console.log(`✅ Audio merged and uploaded: ${finalAudioUrl}`)
    }

    console.log(`🎉 Audio generation complete: ${finalAudioUrl}`)

    return NextResponse.json({
      audioUrl: finalAudioUrl,
      chunks: successfulResults.length,
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
 * Merge multiple WAV buffers into a single WAV file
 * Assumes all WAV files have the same format (sample rate, channels, bit depth)
 */
function mergeWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) throw new Error('No buffers to merge')
  if (buffers.length === 1) return buffers[0]

  // WAV header is 44 bytes
  const WAV_HEADER_SIZE = 44

  // Extract audio data from each WAV (skip header)
  const audioDataChunks: Buffer[] = buffers.map(buf => buf.subarray(WAV_HEADER_SIZE))
  
  // Calculate total audio data length
  const totalAudioLength = audioDataChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  
  // Read format info from first WAV header
  const firstBuffer = buffers[0]
  const numChannels = firstBuffer.readUInt16LE(22)
  const sampleRate = firstBuffer.readUInt32LE(24)
  const bitsPerSample = firstBuffer.readUInt16LE(34)
  const byteRate = firstBuffer.readUInt32LE(28)
  const blockAlign = firstBuffer.readUInt16LE(32)
  
  console.log(`  WAV format: ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}bit`)
  
  // Create new WAV header with updated sizes
  const totalFileSize = WAV_HEADER_SIZE + totalAudioLength - 8 // File size minus "RIFF" and size field
  const header = Buffer.alloc(WAV_HEADER_SIZE)
  
  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(totalFileSize, 4)
  header.write('WAVE', 8)
  
  // fmt subchunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  
  // data subchunk
  header.write('data', 36)
  header.writeUInt32LE(totalAudioLength, 40)
  
  // Concatenate header and all audio data
  return Buffer.concat([header, ...audioDataChunks])
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

