import * as fal from '@fal-ai/serverless-client'
import { VoiceOption, AvatarOption, ScriptChunk } from '@/types'

let falConfigured = false

function ensureFalConfigured() {
  if (!falConfigured) {
    fal.config({
      credentials: process.env.FAL_KEY,
    })
    falConfigured = true
  }
}

/**
 * Liste des voix disponibles pour la génération audio
 * Utilise Minimax Voice Clone avec l'audio de référence Sud-Ouest
 */
export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'sudouest-clone',
    name: 'Voix Sud-Ouest (Clonée)',
    language: 'fr',
    gender: 'male',
  },
]

/**
 * Liste des avatars disponibles pour la génération vidéo
 * Utilise l'avatar Sud-Ouest hébergé publiquement
 */
export const AVAILABLE_AVATARS: AvatarOption[] = [
  {
    id: 'sudouest-default',
    name: 'Avatar Sud-Ouest',
    thumbnailUrl: 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png',
    gender: 'male',
  },
]

interface GenerateAudioOptions {
  text?: string
  voiceId: string
  scriptChunks?: ScriptChunk[] // Passer directement les chunks du script
  onProgress?: (percent: number, message: string) => void // Callback pour la progression
}

export interface AudioChunk {
  url: string
  text: string
  chunkIndex: number
  duration?: number
  section?: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

interface GenerateAudioResult {
  audioUrl?: string // URL unique si un seul chunk
  audioChunks?: AudioChunk[] // Plusieurs chunks si texte long
  duration: number
}

/**
 * Merge plusieurs chunks audio pour créer des segments de max 15 secondes
 * Appelle l'API route pour effectuer le merge côté serveur
 */
export async function mergeAudioChunks(chunks: AudioChunk[], maxDuration: number = 15): Promise<AudioChunk[]> {
  // Estimer ~3 caractères par seconde de parole
  const CHARS_PER_SECOND = 20
  const maxChars = maxDuration * CHARS_PER_SECOND
  
  const mergedChunks: AudioChunk[] = []
  let currentBatch: AudioChunk[] = []
  let currentBatchChars = 0
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    // Si ajouter ce chunk dépasse la limite, merger le batch actuel d'abord
    if (currentBatch.length > 0 && currentBatchChars + chunk.text.length > maxChars) {
      // Merger le batch actuel
      if (currentBatch.length === 1) {
        mergedChunks.push(currentBatch[0])
      } else {
        const mergedUrl = await mergeMultipleAudioFiles(currentBatch, mergedChunks.length)
        mergedChunks.push({
          url: mergedUrl,
          text: currentBatch.map(c => c.text).join(' '),
          chunkIndex: mergedChunks.length,
          section: currentBatch[0].section,
          articleTitle: currentBatch[0].articleTitle,
        })
      }
      
      // Commencer un nouveau batch
      currentBatch = [chunk]
      currentBatchChars = chunk.text.length
    } else {
      currentBatch.push(chunk)
      currentBatchChars += chunk.text.length
    }
  }
  
  // Merger le dernier batch
  if (currentBatch.length > 0) {
    if (currentBatch.length === 1) {
      mergedChunks.push(currentBatch[0])
    } else {
      const mergedUrl = await mergeMultipleAudioFiles(currentBatch, mergedChunks.length)
      mergedChunks.push({
        url: mergedUrl,
        text: currentBatch.map(c => c.text).join(' '),
        chunkIndex: mergedChunks.length,
        section: currentBatch[0].section,
        articleTitle: currentBatch[0].articleTitle,
      })
    }
  }
  
  return mergedChunks
}

/**
 * Merge plusieurs fichiers audio en appelant l'API
 */
async function mergeMultipleAudioFiles(chunks: AudioChunk[], batchIndex: number): Promise<string> {
  console.log(`Merging ${chunks.length} audio chunks into one (batch ${batchIndex})`)
  
  // Pour l'instant, merger 2 par 2
  if (chunks.length === 2) {
    const response = await fetch('/api/audio/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url1: chunks[0].url,
        url2: chunks[1].url,
        batchIndex,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to merge chunks: ${response.statusText}`)
    }

    const data = await response.json()
    return data.url
  }
  
  // Si plus de 2 chunks, merger par paires puis merger les résultats
  // Pour simplifier, retourner le premier pour l'instant
  return chunks[0].url
}

/**
 * Génère un fichier audio à partir des chunks de script
 * Utilise Minimax Voice Clone avec l'URL de référence Sud-Ouest
 * Les chunks générés seront directement utilisables (pas de merge ici)
 */
export async function generateAudio({
  text,
  voiceId,
  scriptChunks,
  onProgress,
}: GenerateAudioOptions): Promise<GenerateAudioResult> {
  ensureFalConfigured()
  try {
    const REFERENCE_AUDIO_URL = 'https://dataiads-test1.fr/sudouest/voix.mp3'
    
    // Si des chunks de script sont fournis, les utiliser directement
    if (scriptChunks && scriptChunks.length > 0) {
      console.log(`🚀 Generating ${scriptChunks.length} audio chunks IN PARALLEL using Minimax Voice Clone`)
      
      if (onProgress) {
        onProgress(10, `Soumission de ${scriptChunks.length} chunks audio en parallèle...`)
      }
      
      // ÉTAPE 1: Soumettre TOUS les chunks en parallèle
      console.log(`📤 Submitting all ${scriptChunks.length} chunks simultaneously...`)
      const submitPromises = scriptChunks.map(async (scriptChunk, i) => {
        console.log(`Submitting chunk ${i + 1}/${scriptChunks.length} (${scriptChunk.text.length} chars)`)
        const { request_id } = await fal.queue.submit('fal-ai/minimax/voice-clone', {
          input: {
            audio_url: REFERENCE_AUDIO_URL,
            text: scriptChunk.text,
            model: 'speech-02-hd',
            noise_reduction: true,
            need_volume_normalization: true,
          },
        })
        console.log(`✅ Chunk ${i + 1} submitted: ${request_id}`)
        return { request_id, scriptChunk, index: i }
      })
      
      const submittedJobs = await Promise.all(submitPromises)
      console.log(`📤 All ${submittedJobs.length} chunks submitted!`)
      
      if (onProgress) {
        onProgress(30, `${scriptChunks.length} chunks soumis, polling des statuts...`)
      }
      
      // ÉTAPE 2: Polling - Attendre que TOUS les jobs soient COMPLETED
      console.log(`⏳ Polling status for all ${submittedJobs.length} jobs...`)
      let completedCount = 0
      
      const pollAndGetResult = async ({ request_id, scriptChunk, index }: { request_id: string, scriptChunk: ScriptChunk, index: number }): Promise<AudioChunk> => {
        // Polling loop until COMPLETED
        let status = 'IN_QUEUE'
        let attempts = 0
        const maxAttempts = 120 // 2 minutes max (polling every 1s)
        
        while (status !== 'COMPLETED' && attempts < maxAttempts) {
          attempts++
          try {
            const statusResponse = await fal.queue.status('fal-ai/minimax/voice-clone', {
              requestId: request_id,
              logs: false,
            })
            status = statusResponse.status
            
            if (status === 'FAILED') {
              throw new Error(`Fal.ai job failed for chunk ${index + 1}`)
            }
            
            if (status !== 'COMPLETED') {
              // Wait 1 second before next poll
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          } catch (pollError) {
            console.error(`Poll error for chunk ${index + 1}:`, pollError)
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (status !== 'COMPLETED') {
          throw new Error(`Timeout waiting for chunk ${index + 1} (status: ${status})`)
        }
        
        // ÉTAPE 3: Récupérer le résultat
        const result = await fal.queue.result('fal-ai/minimax/voice-clone', {
          requestId: request_id,
        }) as { audio: { url: string } }
        
        console.log(`Raw audio result for chunk ${index + 1}:`, JSON.stringify(result, null, 2))
        
        // Le résultat est directement { audio: { url: ... } } sans wrapper "data"
        const audioUrl = result?.audio?.url
        
        if (!audioUrl) {
          console.error(`❌ No audio URL found in result for chunk ${index + 1}:`, result)
          throw new Error(`No audio URL in response for chunk ${index + 1}`)
        }
        
        completedCount++
        console.log(`✅ Chunk ${index + 1} completed (${completedCount}/${submittedJobs.length}): ${audioUrl}`)
        
        if (onProgress) {
          const progress = 30 + Math.floor((completedCount / submittedJobs.length) * 60)
          onProgress(progress, `Audio ${completedCount}/${submittedJobs.length} terminé`)
        }
        
        return {
          url: audioUrl,
          text: scriptChunk.text,
          chunkIndex: scriptChunk.index,
          section: scriptChunk.section,
          articleTitle: scriptChunk.articleTitle,
        }
      }
      
      // Exécuter tous les polling/résultats en parallèle
      const audioChunks = await Promise.all(submittedJobs.map(pollAndGetResult))
      
      // Trier par index pour maintenir l'ordre
      audioChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
      
      console.log(`🎉 All ${audioChunks.length} audio chunks generated in parallel!`)
      
      if (onProgress) {
        onProgress(95, 'Tous les chunks audio générés avec succès!')
      }
      
      return {
        audioChunks,
        duration: 0,
      }
    }
    
    // Fallback : générer à partir du texte simple (ancien comportement)
    if (!text) {
      throw new Error('No text or script chunks provided')
    }
    
    console.log(`Generating audio from text (${text.length} chars)`)
    
    const result = await fal.subscribe('fal-ai/minimax/voice-clone', {
      input: {
        audio_url: REFERENCE_AUDIO_URL,
        text: text.substring(0, 300), // Limiter à 300 chars
        model: 'speech-02-hd',
        noise_reduction: true,
        need_volume_normalization: true,
      },
      logs: true,
    }) as { audio: { url: string } }
    
    return {
      audioUrl: result.audio.url,
      duration: 0,
    }
  } catch (error) {
    console.error('❌ Error generating audio with Minimax:', error)
    
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      throw error
    }
    
    throw new Error(String(error))
  }
}


interface GenerateVideoOptions {
  audioUrl: string
  avatarId: string
  avatarImageUrl?: string
}

interface GenerateVideoResult {
  videoUrl: string
  duration: number
  requestId?: string
}

/**
 * Génère une vidéo avec AI Avatar et lip-sync à partir d'un audio
 * Utilise Kling AI Avatar avec l'avatar Sud-Ouest hébergé publiquement
 */
export async function generateVideo({
  audioUrl,
  avatarId,
  avatarImageUrl,
}: GenerateVideoOptions): Promise<GenerateVideoResult> {
  ensureFalConfigured()
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Generating video with Kling AI Avatar`)
      console.log(`  Audio URL: ${audioUrl}`)
      
      // Utiliser l'URL publique de l'avatar Sud-Ouest
      const imageUrl = avatarImageUrl || 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png'
      
      console.log(`  Avatar image URL: ${imageUrl}`)
      
      // Vérifier que les URLs sont valides
      if (!audioUrl || !audioUrl.startsWith('http')) {
        throw new Error(`Invalid audio URL: ${audioUrl}`)
      }
      
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error(`Invalid image URL: ${imageUrl}`)
      }
      
      // ÉTAPE 1: Submit pour obtenir le request_id
      console.log('Submitting to fal.queue.submit...')
      const { request_id } = await fal.queue.submit('fal-ai/kling-video/v1/standard/ai-avatar', {
        input: {
          image_url: imageUrl,
          audio_url: audioUrl,
          prompt: '.',
        },
      })

      console.log(`✅ Submitted with request_id: ${request_id}`)

      // ÉTAPE 2: Attendre le résultat avec queue.result
      console.log('Waiting for result...')
      const result = await fal.queue.result('fal-ai/kling-video/v1/standard/ai-avatar', {
        requestId: request_id,
      }) as { data: { video: { url: string }, duration?: number } }

      console.log('Raw result from fal.ai:', JSON.stringify(result, null, 2))

      // Extraire les données
      const videoResult = result.data
      
      // Vérifier que le résultat est valide
      if (!videoResult || !videoResult.video || !videoResult.video.url) {
        throw new Error('Invalid response from fal.ai: missing video URL')
      }

      console.log(`✅ Video generated successfully on attempt ${attempt}`)
      console.log(`Video URL: ${videoResult.video.url}`)
      console.log(`Request ID: ${request_id}`)
      
      return {
        videoUrl: videoResult.video.url,
        duration: videoResult.duration || 0,
        requestId: request_id,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`)
      console.error('Error type:', error)
      console.error('Error message:', lastError.message)
      
      // Log l'erreur complète de fal.ai
      if (error && typeof error === 'object') {
        try {
          console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        } catch {
          console.error('Error object (non-serializable):', error)
        }
      }
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000 // Backoff: 2s, 4s, 6s
        console.log(`⏳ Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  console.error(`❌ All ${maxRetries} attempts failed for video generation`)
  console.error('Last error:', lastError)
  throw lastError || new Error('Failed to generate video with AI Avatar after retries')
}

/**
 * Récupère l'URL de l'image de l'avatar
 */
function getAvatarImageUrl(avatarId: string): string {
  const avatar = AVAILABLE_AVATARS.find(a => a.id === avatarId)
  return avatar?.thumbnailUrl || AVAILABLE_AVATARS[0].thumbnailUrl
}

/**
 * Génère des sous-titres pour une vidéo
 */
export async function generateCaptions(audioUrl: string): Promise<string> {
  ensureFalConfigured()
  try {
    // Utiliser Whisper pour la transcription
    const result = await fal.subscribe('fal-ai/whisper', {
      input: {
        audio_url: audioUrl,
        task: 'transcribe',
        language: 'fr',
        chunk_level: 'segment',
        version: '3',
      },
    }) as { chunks: Array<{ text: string, timestamp: [number, number] }> }

    // Convertir en format SRT ou VTT
    return convertToSRT(result.chunks)
  } catch (error) {
    console.error('Error generating captions:', error)
    throw new Error('Failed to generate captions')
  }
}

/**
 * Convertit les chunks de transcription en format SRT
 */
function convertToSRT(chunks: Array<{ text: string; timestamp: [number, number] }>): string {
  return chunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp
      return `${index + 1}
${formatTimestamp(start)} --> ${formatTimestamp(end)}
${chunk.text}
`
    })
    .join('\n')
}

/**
 * Formate un timestamp en format SRT (HH:MM:SS,mmm)
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

