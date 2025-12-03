'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import StepOne from '@/components/features/StepOne'
import StepTwo from '@/components/features/StepTwo'
import StepThree from '@/components/features/StepThree'
import StepFour from '@/components/features/StepFour'
import { ArticleWithScore, PodcastScript } from '@/types'
import { AudioChunk } from '@/lib/services/fal'
import { Loader2, FileText, Video, Newspaper, CheckCircle2, Home, Mic, Film } from 'lucide-react'

export default function CreatePodcastPage() {
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume')

  const [podcastId, setPodcastId] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState<'1' | '2' | '3' | '4'>('1')
  const [selectedArticles, setSelectedArticles] = useState<ArticleWithScore[]>([])
  const [script, setScript] = useState<PodcastScript | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])
  const [loadingResume, setLoadingResume] = useState(false)

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
        if (podcast.audioChunks) {
          setAudioChunks(podcast.audioChunks)
          if (podcast.audioChunks.length > 0) {
            setAudioUrl(podcast.audioChunks[0].url)
          }
        }
        
        // Set current step based on podcast status
        const stepMap: Record<string, '1' | '2' | '3' | '4'> = {
          draft: '1',
          articles_selected: '2',
          script_ready: '3',
          audio_generated: '4',
          video_generating: '4',
          video_generated: '4',
          completed: '4',
        }
        setCurrentStep(stepMap[podcast.status] || '1')
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

    // Créer un job audio en DB (status: queued)
    const jobId = `audio-job-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    await fetch('/api/audio-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: jobId,
        podcastId: podcastId || null,
        scriptChunks: generatedScript.chunks || null,
        voiceId: 'sudouest-clone',
        status: 'queued',
      }),
    })

    console.log(`✅ Audio job created: ${jobId}, worker will process it`)

    // Passer directement à l'étape Vidéo
    setCurrentStep('4')
    
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
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                ID: #{podcastId}
              </span>
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


