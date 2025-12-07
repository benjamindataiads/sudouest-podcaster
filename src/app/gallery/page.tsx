'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useVideoGeneration } from '@/contexts/VideoGenerationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2, Film, Check, X, ArrowUp, ArrowDown, Trash2, Download, Newspaper, FileText, Video, Type, Settings2 } from 'lucide-react'

// Subtitle configuration types
interface SubtitleConfig {
  fontName: string
  fontSize: number
  fontColor: string
  highlightColor: string
  strokeWidth: number
  strokeColor: string
  position: 'top' | 'center' | 'bottom'
  yOffset: number
  wordsPerSubtitle: number
  enableAnimation: boolean
}

const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  fontName: 'Montserrat',
  fontSize: 80,
  fontColor: 'white',
  highlightColor: 'yellow',
  strokeWidth: 3,
  strokeColor: 'black',
  position: 'bottom',
  yOffset: 75,
  wordsPerSubtitle: 3,
  enableAnimation: true,
}

const FONT_OPTIONS = ['Montserrat', 'Poppins', 'Bebas Neue', 'Oswald', 'Inter', 'Roboto', 'BBH Sans Hegarty']
const COLOR_OPTIONS = ['white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'magenta']
const POSITION_OPTIONS = [
  { value: 'top', label: 'Haut' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom', label: 'Bas' },
]

interface SelectedVideo {
  id: string
  videoUrl: string
  text?: string
  order: number
}

function GalleryPageContent() {
  const { isLoaded, isSignedIn, orgId } = useAuth()
  const searchParams = useSearchParams()
  const podcastId = searchParams.get('podcastId') ? parseInt(searchParams.get('podcastId')!) : null
  
  const { jobs, isGenerating, refreshJobs } = useVideoGeneration()
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideo[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [includeIntro, setIncludeIntro] = useState(false)
  const [includeOutro, setIncludeOutro] = useState(false)
  const [podcast, setPodcast] = useState<{selectedArticles?: Array<Record<string, unknown>>, script?: Record<string, unknown>, audioChunks?: Array<Record<string, unknown>>, finalVideoUrl?: string} | null>(null)
  
  // Ref to prevent multiple workers from running simultaneously
  const workerRunningRef = useRef(false)
  
  // Subtitle state
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG)
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false)
  const [subtitledVideoUrl, setSubtitledVideoUrl] = useState<string>('')
  const [showSubtitleOptions, setShowSubtitleOptions] = useState(false)

  // Charger le podcast pour afficher la navigation (wait for auth)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    
    if (podcastId) {
      fetch(`/api/podcasts/${podcastId}`)
        .then(res => res.json())
        .then(data => {
          setPodcast(data.podcast)
          // Si le podcast a déjà une vidéo finale, l'afficher
          if (data.podcast?.finalVideoUrl) {
            setMergedVideoUrl(data.podcast.finalVideoUrl)
          }
        })
        .catch(err => console.error('Error loading podcast:', err))
    }
  }, [podcastId, isLoaded, isSignedIn, orgId])

  const completedJobs = jobs.filter(job => job.status === 'completed')
  const generatingJobs = jobs.filter(job => job.status === 'generating' || job.status === 'queued')
  const failedJobs = jobs.filter(job => job.status === 'failed')

  // Charger les jobs au montage (filtrés par podcast si podcastId fourni)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    
    console.log(`📂 Loading gallery for podcast: ${podcastId || 'all'} (org: ${orgId})`)
    
    // Vérifier les jobs bloqués avant de charger
    fetch('/api/video-jobs/check-stale')
      .then(res => res.json())
      .then(data => {
        if (data.staleJobsFound > 0) {
          console.log(`⚠️ Reset ${data.staleJobsFound} stale jobs`)
        }
      })
      .catch(err => console.error('Error checking stale jobs:', err))
      .finally(() => {
        refreshJobs(podcastId || undefined)
      })
  }, [podcastId, refreshJobs, isLoaded, isSignedIn, orgId])

  // Rafraîchir automatiquement si des vidéos sont en cours de génération
  useEffect(() => {
    if (isGenerating || generatingJobs.length > 0) {
      console.log(`🔄 Starting polling for ${generatingJobs.length} jobs in progress...`)
      
      const interval = setInterval(() => {
        console.log(`🔄 Refreshing ${generatingJobs.length} generating jobs...`)
        refreshJobs(podcastId || undefined)
      }, 2000) // Poll toutes les 2 secondes pour plus de réactivité
      
      return () => {
        console.log('⏸️ Stopping polling')
        clearInterval(interval)
      }
    }
  }, [isGenerating, generatingJobs.length, podcastId, refreshJobs])

  // Worker: Traiter les jobs en attente côté serveur
  useEffect(() => {
    const queuedJobs = jobs.filter(j => j.status === 'queued')
    
    // Prevent multiple workers from running simultaneously
    if (queuedJobs.length > 0 && !workerRunningRef.current) {
      workerRunningRef.current = true
      console.log(`🔧 Found ${queuedJobs.length} queued jobs, starting worker...`)
      
      // Fonction récursive pour traiter les jobs un par un
      const processNextJob = async () => {
        try {
          const response = await fetch('/api/video-jobs/process', {
            method: 'POST',
          })
          
          const data = await response.json()
          
          if (data.success) {
            console.log(`✅ Job ${data.jobId} submitted to fal.ai`)
            // Rafraîchir pour afficher le résultat
            await refreshJobs(podcastId || undefined)
            
            // S'il reste des jobs, continuer
            if (data.hasMore) {
              console.log('➡️ Processing next job...')
              setTimeout(processNextJob, 1000) // Petite pause entre chaque job
            } else {
              console.log('✅ All jobs submitted to fal.ai')
              workerRunningRef.current = false
            }
          } else if (data.hasMore) {
            // Job a échoué mais il y en a d'autres, continuer
            console.log('⚠️ Job failed, trying next one...')
            setTimeout(processNextJob, 2000)
          } else if (data.message === 'No jobs to process') {
            // No more jobs to process
            console.log('✅ No more jobs to process')
            workerRunningRef.current = false
          } else {
            workerRunningRef.current = false
          }
        } catch (error) {
          console.error('Worker error:', error)
          // Retry après une pause
          setTimeout(processNextJob, 5000)
        }
      }
      
      // Démarrer le worker
      processNextJob()
    }
  }, [jobs, podcastId, refreshJobs])

  const toggleVideoSelection = (job: typeof jobs[0]) => {
    if (!job.videoUrl) return

    const isSelected = selectedVideos.some(v => v.id === job.id)
    
    if (isSelected) {
      setSelectedVideos(prev => prev.filter(v => v.id !== job.id))
    } else {
      setSelectedVideos(prev => [...prev, {
        id: job.id,
        videoUrl: job.videoUrl!,
        text: job.text || undefined,
        order: prev.length,
      }])
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newVideos = [...selectedVideos]
    ;[newVideos[index - 1], newVideos[index]] = [newVideos[index], newVideos[index - 1]]
    setSelectedVideos(newVideos.map((v, i) => ({ ...v, order: i })))
  }

  const moveDown = (index: number) => {
    if (index === selectedVideos.length - 1) return
    const newVideos = [...selectedVideos]
    ;[newVideos[index], newVideos[index + 1]] = [newVideos[index + 1], newVideos[index]]
    setSelectedVideos(newVideos.map((v, i) => ({ ...v, order: i })))
  }

  const removeVideo = (id: string) => {
    setSelectedVideos(prev => prev.filter(v => v.id !== id).map((v, i) => ({ ...v, order: i })))
  }

  const mergeSelectedVideos = async () => {
    if (selectedVideos.length === 0) {
      alert('Veuillez sélectionner au moins une vidéo')
      return
    }

    try {
      setIsMerging(true)
      setProgress(10)

      // Construire la liste des vidéos avec intro/outro optionnels
      const videoUrls: string[] = []
      
      if (includeIntro) {
        videoUrls.push('https://dataiads-test1.fr/sudouest/intro.mp4')
      }
      
      videoUrls.push(...selectedVideos
        .sort((a, b) => a.order - b.order)
        .map(v => v.videoUrl))
      
      if (includeOutro) {
        videoUrls.push('https://dataiads-test1.fr/sudouest/intro.mp4') // Même vidéo pour l'instant
      }

      console.log('🎬 Starting merge of', videoUrls.length, 'videos (intro:', includeIntro, 'outro:', includeOutro, ')')
      console.log('Video URLs:', videoUrls)

      setProgress(30)

      const response = await fetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrls,
          withCaptions: false,
          podcastId: podcastId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Assemble error:', errorData)
        throw new Error(errorData.details || errorData.error || 'Erreur lors de l\'assemblage')
      }

      setProgress(90)
      const data = await response.json()
      console.log('✅ Merge completed:', data.videoUrl)
      setMergedVideoUrl(data.videoUrl)
      setProgress(100)
    } catch (error) {
      console.error('❌ Erreur lors de la fusion:', error)
      alert(`Erreur lors de la fusion: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsMerging(false)
      setProgress(0)
    }
  }

  // Generate subtitles for the merged video
  const generateSubtitles = async () => {
    const videoToSubtitle = subtitledVideoUrl || mergedVideoUrl
    
    if (!videoToSubtitle) {
      alert('Veuillez d\'abord assembler une vidéo')
      return
    }

    try {
      setIsGeneratingSubtitles(true)
      console.log('📝 Generating subtitles for:', videoToSubtitle)
      console.log('   Config:', subtitleConfig)

      const response = await fetch('/api/genai/subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoToSubtitle,
          ...subtitleConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Erreur lors de la génération des sous-titres')
      }

      const data = await response.json()
      console.log('✅ Subtitles generated:', data.videoUrl)
      console.log('   Subtitle count:', data.subtitleCount)
      
      setSubtitledVideoUrl(data.videoUrl)
      alert(`✅ Sous-titres générés ! (${data.subtitleCount} segments)`)
    } catch (error) {
      console.error('❌ Erreur lors de la génération des sous-titres:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsGeneratingSubtitles(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Galerie des vidéos</h1>
            <p className="text-gray-500">Assemblez et finalisez vos vidéos de podcast</p>
          </div>

          {/* Navigation des étapes */}
          {podcastId && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
              <nav className="flex items-center">
                <Link href={`/create?resume=${podcastId}`} className="flex-1">
                  <button className="w-full px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200 hover:bg-gray-50">
                    <Newspaper className="h-5 w-5 text-gray-400" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-600">Articles</div>
                      {podcast?.selectedArticles && Array.isArray(podcast.selectedArticles) && (
                        <div className="text-xs text-gray-500">{podcast.selectedArticles.length} sélectionnés</div>
                      )}
                    </div>
                  </button>
                </Link>

                <Link href={`/create?resume=${podcastId}`} className="flex-1">
                  <button className="w-full px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200 hover:bg-gray-50">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-600">Script</div>
                      {podcast?.script && (
                        <div className="text-xs text-gray-500">Généré</div>
                      )}
                    </div>
                  </button>
                </Link>

                <Link href={`/create?resume=${podcastId}`} className="flex-1">
                  <button className="w-full px-6 py-4 flex items-center justify-center gap-3 transition-all border-r border-gray-200 hover:bg-gray-50">
                    <Video className="h-5 w-5 text-gray-400" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-600">Production</div>
                      {podcast?.audioChunks && Array.isArray(podcast.audioChunks) && (
                        <div className="text-xs text-gray-500">{podcast.audioChunks.length} audio</div>
                      )}
                    </div>
                  </button>
                </Link>

                <div className="flex-1 px-6 py-4 flex items-center justify-center gap-3 bg-gray-50 border-b-2 border-b-gray-900">
                  <Film className="h-5 w-5 text-gray-900" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Galerie</div>
                    <div className="text-xs text-gray-500">{completedJobs.length} vidéos</div>
                  </div>
                </div>
              </nav>
            </div>
          )}

          {/* Statut de génération */}
          {isGenerating && (
            <Card className="mb-6 border-purple-500 bg-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <div className="flex-1">
                    <p className="font-medium text-purple-900">
                      {generatingJobs.length} vidéo{generatingJobs.length > 1 ? 's' : ''} en cours de génération...
                    </p>
                    <p className="text-sm text-purple-700">
                      Les vidéos apparaîtront ci-dessous dès qu'elles seront prêtes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vidéos disponibles */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Vidéos générées ({completedJobs.length})</CardTitle>
                      <CardDescription>
                        Cliquez sur une vidéo pour la sélectionner
                        {generatingJobs.length > 0 && (
                          <span className="ml-2 text-orange-600">
                            • {generatingJobs.length} en cours...
                          </span>
                        )}
                      </CardDescription>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await fetch('/api/video-jobs/check-stale')
                          await refreshJobs(podcastId || undefined)
                        }}
                        className="border-gray-200"
                      >
                        <Loader2 className="h-4 w-4 mr-1" />
                        Actualiser
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {completedJobs.length === 0 && !isGenerating && (
                    <div className="text-center py-12 text-gray-500">
                      <Film className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Aucune vidéo générée</p>
                      <p className="text-sm mt-1">Générez des vidéos depuis la page de création</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vidéos en cours */}
                    {generatingJobs.map((job) => (
                      <div key={job.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Segment {job.audioChunkIndex + 1}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{job.text}</p>
                        <div className="mt-2">
                          <Progress value={50} className="h-1" />
                        </div>
                      </div>
                    ))}

                    {/* Vidéos complétées */}
                    {completedJobs.map((job) => {
                      const isSelected = selectedVideos.some(v => v.id === job.id)
                      const selectionNumber = selectedVideos.findIndex(v => v.id === job.id)
                      
                      return (
                        <div
                          key={job.id}
                          onClick={() => toggleVideoSelection(job)}
                          className={`
                            border rounded-lg p-4 cursor-pointer transition-all relative
                            ${isSelected 
                              ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500 shadow-lg' 
                              : 'border-gray-200 hover:border-purple-400 hover:shadow-md bg-white'
                            }
                          `}
                        >
                          {/* Checkbox visible */}
                          <div className="absolute top-3 right-3 z-10">
                            <div className={`
                              w-6 h-6 rounded-full border-2 flex items-center justify-center
                              ${isSelected 
                                ? 'bg-purple-600 border-purple-600' 
                                : 'bg-white border-gray-400'
                            }
                            `}>
                              {isSelected && (
                                <Check className="h-4 w-4 text-white" />
                              )}
                            </div>
                          </div>

                          {/* Numéro de sélection */}
                          {isSelected && (
                            <div className="absolute top-3 left-3 z-10 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              {selectionNumber + 1}
                            </div>
                          )}

                          {job.videoUrl && (
                            <video 
                              src={job.videoUrl} 
                              className="w-full aspect-video rounded mb-3 object-cover"
                              controls
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1">
                                Segment {job.audioChunkIndex + 1}
                                {isSelected && <span className="ml-2 text-purple-600">✓ Sélectionné</span>}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-2">{job.text}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Vidéos échouées */}
                  {failedJobs.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-semibold text-red-600">Échecs</h4>
                      {failedJobs.map((job) => (
                        <div key={job.id} className="border border-red-300 rounded-lg p-3 bg-red-50">
                          <div className="flex items-start">
                            <X className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">Segment {job.audioChunkIndex + 1}</p>
                              <p className="text-xs text-red-700">{job.error || 'Erreur inconnue'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Panneau de sélection et d'assemblage */}
            <div className="space-y-4">
              <Card className={`border ${selectedVideos.length > 0 ? 'border-purple-500 bg-purple-50/50' : 'border-gray-200'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5" />
                    Sélection ({selectedVideos.length})
                  </CardTitle>
                  <CardDescription>
                    {selectedVideos.length === 0 
                      ? '👈 Cliquez sur les vidéos de gauche pour les sélectionner'
                      : 'Réorganisez l\'ordre avec les flèches puis assemblez'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedVideos.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="mb-3">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-2">
                          <Check className="h-8 w-8" />
                        </div>
                      </div>
                      <p className="font-medium mb-1">Aucune vidéo sélectionnée</p>
                      <p className="text-sm">
                        Cliquez sur les vidéos à gauche pour les ajouter à la liste
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedVideos.map((video, index) => {
                        const job = jobs.find(j => j.id === video.id)
                        return (
                          <div key={video.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  #{index + 1} - Segment {job?.audioChunkIndex ? job.audioChunkIndex + 1 : '?'}
                                </p>
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {video.text?.substring(0, 50)}...
                                </p>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => moveUp(index)}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => moveDown(index)}
                                  disabled={index === selectedVideos.length - 1}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeVideo(video.id)}
                                  className="p-1 hover:bg-red-100 rounded text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {selectedVideos.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {/* Options intro/outro */}
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900">Options d'assemblage</h4>
                        
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeIntro}
                            onChange={(e) => setIncludeIntro(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              Ajouter une intro
                            </div>
                            <div className="text-xs text-gray-500">
                              Vidéo d'introduction au début
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeOutro}
                            onChange={(e) => setIncludeOutro(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              Ajouter une outro
                            </div>
                            <div className="text-xs text-gray-500">
                              Vidéo de conclusion à la fin
                            </div>
                          </div>
                        </label>
                      </div>

                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                        <p className="font-medium text-purple-900 mb-1">Prêt à assembler</p>
                        <p className="text-purple-700 text-xs">
                          {includeIntro && 'Intro + '}
                          {selectedVideos.length} segment{selectedVideos.length > 1 ? 's' : ''}
                          {includeOutro && ' + Outro'}
                          {' '}= {(includeIntro ? 1 : 0) + selectedVideos.length + (includeOutro ? 1 : 0)} vidéo{(includeIntro ? 1 : 0) + selectedVideos.length + (includeOutro ? 1 : 0) > 1 ? 's' : ''} au total
                        </p>
                      </div>

                      <Button
                        onClick={mergeSelectedVideos}
                        disabled={isMerging || selectedVideos.length === 0}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                        size="lg"
                      >
                        {isMerging ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Assemblage en cours...
                          </>
                        ) : (
                          <>
                            <Film className="mr-2 h-4 w-4" />
                            Assembler {selectedVideos.length} vidéo{selectedVideos.length > 1 ? 's' : ''}
                          </>
                        )}
                      </Button>

                      {isMerging && (
                        <div className="space-y-2">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-center text-gray-500">{progress}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vidéo finale */}
              {mergedVideoUrl && (
                <Card className="border-green-500 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-900">✅ Vidéo assemblée</CardTitle>
                    <CardDescription className="text-green-700">
                      {subtitledVideoUrl ? 'Vidéo de base (sans sous-titres)' : 'Prête pour les sous-titres ou la publication'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <video 
                      src={mergedVideoUrl} 
                      controls 
                      className="w-full rounded border-2 border-green-200"
                    />
                    {!subtitledVideoUrl && (
                      <div className="flex gap-2">
                        <Button asChild className="flex-1 bg-green-600 hover:bg-green-700">
                          <a href={mergedVideoUrl} download="podcast-final.mp4">
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </a>
                        </Button>
                        <Button 
                          onClick={async () => {
                            if (!podcastId) {
                              alert('⚠️ Aucun podcast associé. Impossible de sauvegarder.')
                              return
                            }
                            
                            try {
                              const res = await fetch(`/api/podcasts/save`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: podcastId,
                                  finalVideoUrl: mergedVideoUrl,
                                  status: 'completed',
                                  completedAt: new Date(),
                                }),
                              })
                              if (res.ok) {
                                alert('✅ Vidéo finale sauvegardée dans le podcast !')
                                window.location.href = '/'
                              } else {
                                alert('❌ Erreur lors de la sauvegarde')
                              }
                            } catch (err) {
                              alert('❌ Erreur lors de la sauvegarde')
                            }
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={!podcastId}
                        >
                          💾 Sauvegarder sans sous-titres
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Section sous-titres (optionnel) */}
              {mergedVideoUrl && (
                <Card className={`border ${subtitledVideoUrl ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className={subtitledVideoUrl ? 'text-purple-900' : ''}>
                          <Type className="inline-block mr-2 h-5 w-5" />
                          Sous-titres (optionnel)
                        </CardTitle>
                        <CardDescription className={subtitledVideoUrl ? 'text-purple-700' : ''}>
                          Ajoutez des sous-titres automatiques style TikTok
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSubtitleOptions(!showSubtitleOptions)}
                        className="border-gray-200"
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        {showSubtitleOptions ? 'Masquer' : 'Options'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Configuration des sous-titres */}
                    {showSubtitleOptions && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900">Configuration des sous-titres</h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {/* Font name */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Police</label>
                            <select
                              value={subtitleConfig.fontName}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, fontName: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            >
                              {FONT_OPTIONS.map(font => (
                                <option key={font} value={font}>{font}</option>
                              ))}
                            </select>
                          </div>

                          {/* Font size */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Taille ({subtitleConfig.fontSize}px)</label>
                            <input
                              type="range"
                              min="40"
                              max="120"
                              value={subtitleConfig.fontSize}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, fontSize: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>

                          {/* Font color */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur texte</label>
                            <select
                              value={subtitleConfig.fontColor}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, fontColor: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            >
                              {COLOR_OPTIONS.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </div>

                          {/* Highlight color */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur surbrillance</label>
                            <select
                              value={subtitleConfig.highlightColor}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, highlightColor: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            >
                              {COLOR_OPTIONS.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </div>

                          {/* Stroke width */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Contour ({subtitleConfig.strokeWidth}px)</label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={subtitleConfig.strokeWidth}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, strokeWidth: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>

                          {/* Stroke color */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Couleur contour</label>
                            <select
                              value={subtitleConfig.strokeColor}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, strokeColor: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            >
                              {COLOR_OPTIONS.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </div>

                          {/* Position */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                            <select
                              value={subtitleConfig.position}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, position: e.target.value as 'top' | 'center' | 'bottom' })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            >
                              {POSITION_OPTIONS.map(pos => (
                                <option key={pos.value} value={pos.value}>{pos.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Y Offset */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Décalage Y ({subtitleConfig.yOffset}px)</label>
                            <input
                              type="range"
                              min="-200"
                              max="200"
                              value={subtitleConfig.yOffset}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, yOffset: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>

                          {/* Words per subtitle */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Mots par ligne ({subtitleConfig.wordsPerSubtitle})</label>
                            <input
                              type="range"
                              min="1"
                              max="12"
                              value={subtitleConfig.wordsPerSubtitle}
                              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, wordsPerSubtitle: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>
                        </div>

                        {/* Animation toggle */}
                        <label className="flex items-center gap-3 cursor-pointer pt-2">
                          <input
                            type="checkbox"
                            checked={subtitleConfig.enableAnimation}
                            onChange={(e) => setSubtitleConfig({ ...subtitleConfig, enableAnimation: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-200 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-medium text-gray-900">
                            Animation des sous-titres (style bounce)
                          </span>
                        </label>

                        {/* Reset button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSubtitleConfig(DEFAULT_SUBTITLE_CONFIG)}
                          className="text-gray-500"
                        >
                          Réinitialiser les options
                        </Button>
                      </div>
                    )}

                    {/* Generate button */}
                    <Button
                      onClick={generateSubtitles}
                      disabled={isGeneratingSubtitles}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      size="lg"
                    >
                      {isGeneratingSubtitles ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Génération des sous-titres en cours...
                        </>
                      ) : (
                        <>
                          <Type className="mr-2 h-4 w-4" />
                          {subtitledVideoUrl ? 'Régénérer les sous-titres' : 'Générer les sous-titres'}
                        </>
                      )}
                    </Button>

                    {/* Preview info */}
                    {!subtitledVideoUrl && (
                      <p className="text-xs text-center text-gray-500">
                        Les sous-titres seront générés automatiquement en français (style TikTok/karaoké)
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Vidéo avec sous-titres */}
              {subtitledVideoUrl && (
                <Card className="border-green-500 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-900">✅ Vidéo finale avec sous-titres</CardTitle>
                    <CardDescription className="text-green-700">
                      Prête à être publiée
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <video 
                      src={subtitledVideoUrl} 
                      controls 
                      className="w-full rounded border-2 border-green-200"
                    />
                    <div className="flex gap-2">
                      <Button asChild className="flex-1 bg-green-600 hover:bg-green-700">
                        <a href={subtitledVideoUrl} download="podcast-final-subtitles.mp4">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </a>
                      </Button>
                      <Button 
                        onClick={async () => {
                          if (!podcastId) {
                            alert('⚠️ Aucun podcast associé. Impossible de sauvegarder.')
                            return
                          }
                          
                          try {
                            const res = await fetch(`/api/podcasts/save`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: podcastId,
                                finalVideoUrl: subtitledVideoUrl,
                                status: 'completed',
                                completedAt: new Date(),
                              }),
                            })
                            if (res.ok) {
                              alert('✅ Vidéo avec sous-titres sauvegardée !')
                              window.location.href = '/'
                            } else {
                              alert('❌ Erreur lors de la sauvegarde')
                            }
                          } catch (err) {
                            alert('❌ Erreur lors de la sauvegarde')
                          }
                        }}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={!podcastId}
                      >
                        💾 Sauvegarder comme vidéo finale
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Podcaster © 2025</span>
              <span>POC Propulsé par l'IA</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default function GalleryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
      </div>
    }>
      <GalleryPageContent />
    </Suspense>
  )
}
