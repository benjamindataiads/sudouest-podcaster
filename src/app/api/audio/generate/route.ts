import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { generateAudio } from '@/lib/services/fal'
import { db, audioFiles, podcasts } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * POST /api/audio/generate
 * Génère un ou plusieurs fichiers audio à partir du script ou des chunks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { podcastId, script, scriptChunks, voiceId = 'sudouest-clone' } = body

    if (!script && !scriptChunks) {
      return NextResponse.json(
        { error: 'Script ou scriptChunks requis' },
        { status: 400 }
      )
    }

    console.log(`Generating audio (voice: ${voiceId})`)
    if (scriptChunks) {
      console.log(`Using ${scriptChunks.length} pre-defined chunks`)
    } else {
      console.log(`Using text (${script.length} chars)`)
    }

    // Générer l'audio avec fal.ai
    const audioResult = await generateAudio({
      text: script,
      scriptChunks,
      voiceId,
    })

    // Cas 1 : Un seul fichier audio
    if (audioResult.audioUrl) {
      if (podcastId) {
        const [audioFile] = await db.insert(audioFiles).values({
          podcastId,
          voiceId,
          fileUrl: audioResult.audioUrl,
          duration: audioResult.duration,
          metadata: { generatedAt: new Date().toISOString() },
        }).returning()

        await db.update(podcasts)
          .set({ 
            status: 'audio_generated',
            updatedAt: new Date(),
          })
          .where(eq(podcasts.id, podcastId))

        return NextResponse.json({
          audioFile,
          audioUrl: audioResult.audioUrl,
          duration: audioResult.duration,
        })
      }

      return NextResponse.json({
        audioUrl: audioResult.audioUrl,
        duration: audioResult.duration,
      })
    }

    // Cas 2 : Plusieurs chunks audio
    if (audioResult.audioChunks) {
      console.log(`Generated ${audioResult.audioChunks.length} audio chunks`)
      
      return NextResponse.json({
        audioChunks: audioResult.audioChunks,
        totalChunks: audioResult.audioChunks.length,
        duration: audioResult.duration,
      })
    }

    throw new Error('No audio generated')
  } catch (error) {
    console.error('❌ Error generating audio:', error)
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération de l\'audio',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}


