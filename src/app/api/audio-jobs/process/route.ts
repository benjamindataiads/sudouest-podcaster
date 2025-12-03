import { NextResponse } from 'next/server'
import { db, audioJobs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateAudio } from '@/lib/services/fal'

/**
 * POST /api/audio-jobs/process
 * Traite un job audio en attente (worker backend)
 */
export async function POST() {
  try {
    // 1. Chercher un job en attente
    const [queuedJob] = await db
      .select()
      .from(audioJobs)
      .where(eq(audioJobs.status, 'queued'))
      .limit(1)

    if (!queuedJob) {
      return NextResponse.json({ 
        message: 'No queued audio jobs',
        hasMore: false 
      })
    }

    console.log(`🎤 Processing audio job: ${queuedJob.id}`)

    // 2. Marquer comme "generating"
    await db
      .update(audioJobs)
      .set({ 
        status: 'generating',
        updatedAt: new Date() 
      })
      .where(eq(audioJobs.id, queuedJob.id))

    try {
      // 3. Générer l'audio avec fal.ai
      console.log(`Generating audio with ${queuedJob.scriptChunks?.length || 0} chunks`)
      
      const audioResult = await generateAudio({
        scriptChunks: queuedJob.scriptChunks || [],
        voiceId: queuedJob.voiceId,
      })

      console.log(`✅ Audio generated: ${audioResult.audioChunks?.length || 1} chunks`)

      // 4. Mettre à jour le job
      await db
        .update(audioJobs)
        .set({
          status: 'completed',
          audioChunks: audioResult.audioChunks || null,
          audioUrl: audioResult.audioUrl || null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(audioJobs.id, queuedJob.id))

      // 5. Mettre à jour le podcast
      if (queuedJob.podcastId && audioResult.audioChunks) {
        const { podcasts } = await import('@/lib/db')
        await db
          .update(podcasts)
          .set({
            audioChunks: audioResult.audioChunks,
            status: 'audio_generated',
            currentStep: 4,
            updatedAt: new Date(),
          })
          .where(eq(podcasts.id, queuedJob.podcastId))
        
        console.log(`✅ Podcast ${queuedJob.podcastId} updated with audio chunks`)
      }

      // Vérifier s'il reste des jobs
      const remainingJobs = await db
        .select()
        .from(audioJobs)
        .where(eq(audioJobs.status, 'queued'))
        .limit(1)

      return NextResponse.json({
        success: true,
        jobId: queuedJob.id,
        audioChunks: audioResult.audioChunks,
        hasMore: remainingJobs.length > 0,
      })

    } catch (error) {
      console.error(`❌ Audio job ${queuedJob.id} failed:`, error)
      
      // Marquer comme failed
      await db
        .update(audioJobs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(audioJobs.id, queuedJob.id))

      return NextResponse.json({
        success: false,
        jobId: queuedJob.id,
        error: error instanceof Error ? error.message : String(error),
        hasMore: true,
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing audio job:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du traitement du job audio',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

