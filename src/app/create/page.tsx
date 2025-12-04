'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import StepOne from '@/components/features/StepOne'
import StepTwo from '@/components/features/StepTwo'
import StepThree from '@/components/features/StepThree'
import StepFour from '@/components/features/StepFour'
import { ArticleWithScore, PodcastScript } from '@/types'
import { AudioChunk } from '@/lib/genai/types'
import { Loader2, FileText, Video, Newspaper, CheckCircle2, Home, Mic, Film } from 'lucide-react'

interface Avatar {
  id: number
  name: string
  voiceUrl: string
  imageUrl: string
  isDefault: boolean
}

type StepType = '1' | '2' | '3' | '4'

function CreatePodcastPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const resumeId = searchParams.get('resume')
  const stepParam = searchParams.get('step') as StepType | null

  const [podcastId, setPodcastId] = useState<number | null>(null)
  const [currentStep, setCurrentStepState] = useState<StepType>('1')
  const [selectedArticles, setSelectedArticles] = useState<ArticleWithScore[]>([])
  const [script, setScript] = useState<PodcastScript | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])
  const [loadingResume, setLoadingResume] = useState(false)
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [audioProgress, setAudioProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 })
  const [audioJobId, setAudioJobId] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Update URL when changing step
  const setCurrentStep = useCallback((step: StepType) => {
    setCurrentStepState(step)
    if (podcastId) {
      const url = `/create?resume=${podcastId}&step=${step}`
      window.history.replaceState({}, '', url)
    }
  }, [podcastId])

  // Simple polling for audio job status
  const pollAudioJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/genai/audio?jobId=${jobId}`)
      if (!response.ok) return
      
      const data = await response.json()
      const job = data.job
      
      console.log(`📊 Audio job status: ${job.status}`)
      
      if (job.status === 'completed' && job.audioChunks) {
        console.log('🎉 Audio generation complete!')
        setAudioChunks(job.audioChunks)
        setAudioUrl(job.audioChunks[0]?.url || '')
        setAudioProgress({ completed: job.audioChunks.length, total: job.audioChunks.length })
        
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        
        // Update podcast in DB
        await fetch('/api/podcasts/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: podcastId,
            audioChunks: job.audioChunks,
            status: 'audio_generated',
          }),
        })
      } else if (job.status === 'failed') {
        console.error('❌ Audio generation failed:', job.error)
        alert(`Erreur audio: ${job.error}`)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } else if (job.audioChunks) {
        // Partial progress
        const completed = job.audioChunks.filter((c: AudioChunk) => c.url).length
        setAudioProgress({ completed, total: job.audioChunks.length })
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, [podcastId])

  // Start polling when audioJobId is set
  useEffect(() => {
    if (audioJobId) {
      console.log(`🔄 Starting audio job polling for ${audioJobId}`)
      // Poll every 3 seconds
      pollingRef.current = setInterval(() => pollAudioJob(audioJobId), 3000)
      // Initial poll
      pollAudioJob(audioJobId)
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [audioJobId, pollAudioJob])

  // Load podcast if resuming
  useEffect(() => {
    if (resumeId) {
      loadPodcast(parseInt(resumeId))
    } else {
      // Pas d'ID, rediriger vers l'accueil
      window.location.href = '/'
    }
  }, [resumeId])

  const loadPodcast = async (id: number) => {
    try {
      setLoadingResume(true)
      const response = await fetch(`/api/podcasts/${id}`)
      if (response.ok) {
        const data = await response.json()
        const podcast = data.podcast
        
        setPodcastId(podcast.id)
        if (podcast.selectedArticles) setSelectedArticles(podcast.selectedArticles)
        if (podcast.script) setScript(podcast.script)
        
        // Load avatar from response
        if (data.avatar) {
          setAvatar(data.avatar)
          console.log('✅ Avatar loaded:', data.avatar.name)
        }
        
        // Check for audio - either from podcast or from audio job
        let hasAudio = false
        if (podcast.audioChunks && podcast.audioChunks.length > 0 && podcast.audioChunks[0].url) {
          setAudioChunks(podcast.audioChunks)
          setAudioUrl(podcast.audioChunks[0].url)
          setAudioProgress({ completed: podcast.audioChunks.length, total: podcast.audioChunks.length })
          hasAudio = true
          console.log('✅ Audio loaded from podcast:', podcast.audioChunks.length, 'chunks')
        }
        
        // Check for pending/generating audio job
        if (!hasAudio) {
          try {
            const audioJobsResponse = await fetch(`/api/genai/audio?podcastId=${id}`)
            if (audioJobsResponse.ok) {
              const audioData = await audioJobsResponse.json()
              const jobs = audioData.jobs || []
              
              // Find the most recent job
              const latestJob = jobs.sort((a: { createdAt: string }, b: { createdAt: string }) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0]
              
              if (latestJob) {
                console.log('📋 Found audio job:', latestJob.id, 'status:', latestJob.status)
                
                if (latestJob.status === 'completed' && latestJob.audioChunks) {
                  // Job is done, load audio
                  setAudioChunks(latestJob.audioChunks)
                  setAudioUrl(latestJob.audioChunks[0]?.url || '')
                  setAudioProgress({ completed: latestJob.audioChunks.length, total: latestJob.audioChunks.length })
                  hasAudio = true
                  console.log('✅ Audio loaded from completed job')
                } else if (latestJob.status === 'generating' || latestJob.status === 'queued') {
                  // Job in progress, start polling
                  console.log('🔄 Audio job in progress, starting polling...')
                  setAudioJobId(latestJob.id)
                  
                  // Set up placeholders from script chunks
                  if (podcast.script?.chunks) {
                    const placeholders = podcast.script.chunks.map((chunk: { text: string; section: string; articleTitle?: string }, idx: number) => ({
                      url: '',
                      chunkIndex: idx,
                      text: chunk.text,
                      section: chunk.section,
                      articleTitle: chunk.articleTitle,
                    }))
                    setAudioChunks(placeholders as AudioChunk[])
                    setAudioProgress({ completed: 0, total: placeholders.length })
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error checking audio jobs:', e)
          }
        }
        
        // Determine current step based on URL param or podcast status
        let step: StepType = '1'
        
        // If stepParam is provided in URL and valid, use it
        if (stepParam && ['1', '2', '3', '4'].includes(stepParam)) {
          step = stepParam
          console.log('📍 Using step from URL:', step)
        } else {
          // Otherwise determine from status
          if (podcast.status === 'draft') {
            step = '1'
          } else if (podcast.status === 'articles_selected') {
            step = '2'
          } else if (podcast.status === 'script_ready' || podcast.status === 'audio_generating') {
            step = '3'
          } else if (hasAudio || podcast.status === 'audio_generated' || podcast.status.includes('video') || podcast.status === 'completed') {
            step = '4'
          }
          console.log('📍 Setting step to:', step, 'based on status:', podcast.status)
        }
        
        setCurrentStepState(step)
        // Update URL
        window.history.replaceState({}, '', `/create?resume=${id}&step=${step}`)
      }
    } catch (error) {
      console.error('Error loading podcast:', error)
    } finally {
      setLoadingResume(false)
    }
  }

  const savePodcast = async (updates: Partial<{
    title: string
    status: string
    currentStep: number
    selectedArticles: ArticleWithScore[]
    script: PodcastScript
    audioChunks: AudioChunk[]
    videoUrls: string[]
    finalVideoUrl: string
    estimatedDuration: number
  }>) => {
    try {
      console.log('💾 Saving podcast...', updates)
      
      const response = await fetch('/api/podcasts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: podcastId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Save failed:', error)
        throw new Error(error.error || 'Erreur de sauvegarde')
      }

        const data = await response.json()
        if (!podcastId && data.podcast) {
          setPodcastId(data.podcast.id)
        console.log('✅ Podcast created with ID:', data.podcast.id)
      } else {
        console.log('✅ Podcast updated')
      }

      return data.podcast
    } catch (error) {
      console.error('❌ Error saving podcast:', error)
      // Afficher une notification à l'utilisateur
      alert('Erreur: Impossible de sauvegarder le podcast. Vos modifications pourraient être perdues.')
      throw error
    }
  }

  const handleStep1Complete = async (articles: ArticleWithScore[]) => {
    setSelectedArticles(articles)
    setCurrentStep('2')
    
    // Save to database (sans écraser le titre)
    await savePodcast({
      status: 'articles_selected',
      currentStep: 2,
      selectedArticles: articles,
    })
  }

  const handleStep2Complete = async (generatedScript: PodcastScript) => {
    setScript(generatedScript)
    setCurrentStep('3')
    
    // Save to database
    await savePodcast({
      status: 'script_ready',
      currentStep: 3,
      script: generatedScript,
      estimatedDuration: generatedScript.estimatedDuration,
    })

    // Créer des placeholders pour l'audio
    const placeholders = (generatedScript.chunks || []).map((chunk, idx) => ({
      url: '',
      chunkIndex: idx,
      text: chunk.text,
      section: chunk.section,
      articleTitle: chunk.articleTitle,
    }))
    
    setAudioChunks(placeholders as AudioChunk[])
    setAudioUrl('generating')
    setAudioProgress({ completed: 0, total: placeholders.length })

    // Use the new GenAI audio endpoint
    console.log(`🎤 Starting audio generation via /api/genai/audio`)
    
    try {
      const response = await fetch('/api/genai/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastId: podcastId,
          scriptChunks: generatedScript.chunks || [],
          voiceUrl: avatar?.voiceUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Failed to start audio generation')
      }

      const result = await response.json()
      console.log(`✅ Audio generation started: ${result.jobId}`)
      
      // Start polling for audio job status
      setAudioJobId(result.jobId)

    } catch (error) {
      console.error('❌ Failed to start audio generation:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Impossible de démarrer la génération audio'}`)
    }

    // Rester sur l'étape 3 (audio) pour voir la progression
    setCurrentStep('3')
  }

  const handleStep3Complete = async (audio: string, chunks?: AudioChunk[]) => {
    setAudioUrl(audio)
    if (chunks) {
      setAudioChunks(chunks)
    }
    setCurrentStep('4')
    
    // Save to database
    await savePodcast({
      status: 'audio_generated',
      currentStep: 4,
      audioChunks: chunks || (audio ? [{ 
        url: audio, 
        chunkIndex: 0,
        text: 'Audio complet',
        section: 'introduction' 
      }] : undefined),
    })
  }

  if (loadingResume) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#D42E1B] mx-auto mb-4" />
          <p className="text-gray-600">Chargement du podcast...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#D42E1B] text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <SudOuestLogo width={100} height={32} fill="white" />
              </Link>
              <div className="hidden md:block h-6 w-px bg-white/30" />
              <h1 className="text-xl md:text-2xl font-bold">
                {resumeId ? 'Reprendre le podcast' : 'Créer un podcast'}
              </h1>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 border border-white/30">
                <Home className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            {podcastId && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                  Podcast #{podcastId}
                </span>
                {audioProgress.total > 0 && audioProgress.completed < audioProgress.total && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/30 text-yellow-100">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Audio {audioProgress.completed}/{audioProgress.total}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Navigation horizontale des étapes */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <nav className="flex items-center">
            {/* Étape 1 : Articles */}
            <button
              onClick={() => setCurrentStep('1')}
              className={`
                flex-1 px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200
                ${currentStep === '1' 
                  ? 'bg-gray-50 border-b-2 border-b-gray-900' 
                  : selectedArticles.length > 0 
                    ? 'hover:bg-gray-50 cursor-pointer' 
                    : 'opacity-50 cursor-default'
                }
              `}
            >
              <Newspaper className={`h-5 w-5 ${currentStep === '1' ? 'text-gray-900' : 'text-gray-400'}`} />
              <div className="text-left">
                <div className={`text-sm font-medium ${currentStep === '1' ? 'text-gray-900' : 'text-gray-600'}`}>
                  Articles
                </div>
                {selectedArticles.length > 0 && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {selectedArticles.length} sélectionnés
                  </div>
                )}
              </div>
            </button>

            {/* Étape 2 : Script */}
            <button
              onClick={() => selectedArticles.length > 0 && setCurrentStep('2')}
              disabled={selectedArticles.length === 0}
              className={`
                flex-1 px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200
                ${currentStep === '2' 
                  ? 'bg-gray-50 border-b-2 border-b-gray-900' 
                  : script 
                    ? 'hover:bg-gray-50 cursor-pointer' 
                    : selectedArticles.length > 0
                      ? 'hover:bg-gray-50 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                }
              `}
            >
              <FileText className={`h-5 w-5 ${currentStep === '2' ? 'text-gray-900' : script ? 'text-gray-400' : 'text-gray-300'}`} />
              <div className="text-left">
                <div className={`text-sm font-medium ${currentStep === '2' ? 'text-gray-900' : 'text-gray-600'}`}>
                  Script
                </div>
                {script && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Généré
                  </div>
                )}
              </div>
            </button>

            {/* Étape 3 : Production (Audio + Vidéo) */}
            <button
              onClick={() => script && setCurrentStep('3')}
              disabled={!script}
              className={`
                flex-1 px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200
                ${currentStep === '3' || currentStep === '4'
                  ? 'bg-gray-50 border-b-2 border-b-gray-900' 
                  : script
                    ? 'hover:bg-gray-50 cursor-pointer' 
                    : 'opacity-40 cursor-not-allowed'
                }
              `}
            >
              <Video className={`h-5 w-5 ${currentStep === '3' || currentStep === '4' ? 'text-gray-900' : script ? 'text-gray-400' : 'text-gray-300'}`} />
              <div className="text-left">
                <div className={`text-sm font-medium ${currentStep === '3' || currentStep === '4' ? 'text-gray-900' : 'text-gray-600'}`}>
                  Production
                </div>
                {audioUrl === 'generating' && (
                  <div className="text-xs text-orange-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Audio...
                  </div>
                )}
                {audioChunks.length > 0 && audioUrl !== 'generating' && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Mic className="h-3 w-3 text-green-600" />
                    {audioChunks.length} audio
                  </div>
                )}
              </div>
            </button>

            {/* Étape 4 : Galerie */}
            {podcastId && (
              <Link href={`/gallery?podcastId=${podcastId}`} className="flex-1">
                <button className="w-full px-6 py-4 flex items-center justify-center gap-3 transition-all hover:bg-gray-50">
                  <Film className="h-5 w-5 text-gray-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-600">
                      Galerie
                    </div>
                    <div className="text-xs text-gray-500">
                      Assemblage
                    </div>
                  </div>
                </button>
              </Link>
            )}
          </nav>
        </div>

        {/* Content */}
        <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as '1' | '2' | '3' | '4')}>
          <TabsList className="hidden">
            <TabsTrigger value="1">Étape 1</TabsTrigger>
            <TabsTrigger value="2">Étape 2</TabsTrigger>
            <TabsTrigger value="3">Étape 3</TabsTrigger>
            <TabsTrigger value="4">Étape 4</TabsTrigger>
          </TabsList>

          <TabsContent value="1">
            <StepOne onComplete={handleStep1Complete} />
          </TabsContent>

          <TabsContent value="2">
            <StepTwo 
              selectedArticles={selectedArticles}
              existingScript={script}
              onComplete={handleStep2Complete}
              onBack={() => setCurrentStep('1')}
            />
          </TabsContent>

          <TabsContent value="3">
            <StepFour 
              audioUrl={audioUrl}
              audioChunks={audioChunks}
              podcastId={podcastId}
              avatar={avatar}
              onBack={() => setCurrentStep('2')}
              onVideoGenerated={async (videoUrl: string) => {
                await savePodcast({
                  status: 'video_generated',
                  finalVideoUrl: videoUrl,
                })
              }}
              onVideosGenerated={async (videoUrls: string[]) => {
                await savePodcast({
                  status: 'video_generated',
                  videoUrls: videoUrls,
                })
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

export default function CreatePodcastPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#D42E1B] mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </main>
    }>
      <CreatePodcastPageContent />
    </Suspense>
  )
}
