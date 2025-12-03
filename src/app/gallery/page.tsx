'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useVideoGeneration } from '@/contexts/VideoGenerationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import { Loader2, Film, Check, X, ArrowUp, ArrowDown, Trash2, Download, Home, Newspaper, FileText, Video } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface SelectedVideo {
  id: string
  videoUrl: string
  text?: string
  order: number
}

function GalleryPageContent() {
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

  // Charger le podcast pour afficher la navigation
  useEffect(() => {
    if (podcastId) {
      fetch(`/api/podcasts/${podcastId}`)
        .then(res => res.json())
        .then(data => {
          setPodcast(data.podcast)
          // Si le podcast a déjà une vidéo finale, l'afficher
          if (data.podcast.finalVideoUrl) {
            setMergedVideoUrl(data.podcast.finalVideoUrl)
          }
        })
        .catch(err => console.error('Error loading podcast:', err))
    }
  }, [podcastId])

  const completedJobs = jobs.filter(job => job.status === 'completed')
  const generatingJobs = jobs.filter(job => job.status === 'generating' || job.status === 'queued')
  const failedJobs = jobs.filter(job => job.status === 'failed')

  // Charger les jobs au montage (filtrés par podcast si podcastId fourni)
  useEffect(() => {
    console.log(`📂 Loading gallery for podcast: ${podcastId || 'all'}`)
    
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
  }, [podcastId, refreshJobs])

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
    
    if (queuedJobs.length > 0) {
      console.log(`🔧 Found ${queuedJobs.length} queued jobs, starting worker...`)
      
      // Fonction récursive pour traiter les jobs un par un
      const processNextJob = async () => {
        try {
          const response = await fetch('/api/video-jobs/process', {
            method: 'POST',
          })
          
          const data = await response.json()
          
          if (data.success) {
            console.log(`✅ Job ${data.jobId} completed`)
            // Rafraîchir pour afficher le résultat
            await refreshJobs(podcastId || undefined)
            
            // S'il reste des jobs, continuer
            if (data.hasMore) {
              console.log('➡️ Processing next job...')
              setTimeout(processNextJob, 1000) // Petite pause entre chaque job
            }
          } else if (data.hasMore) {
            // Job a échoué mais il y en a d'autres, continuer
            console.log('⚠️ Job failed, trying next one...')
            setTimeout(processNextJob, 2000)
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(selectedVideos)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Mettre à jour les ordres
    const reordered = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    setSelectedVideos(reordered)
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

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#D42E1B] text-white shadow-lg mb-8">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <SudOuestLogo width={100} height={32} fill="white" />
              </Link>
              <div className="hidden md:block h-6 w-px bg-white/30" />
              <h1 className="text-xl md:text-2xl font-bold">
                Galerie des vidéos
              </h1>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 border border-white/30">
                <Home className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
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
        <Card className="mb-6 border-blue-500 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  {generatingJobs.length} vidéo{generatingJobs.length > 1 ? 's' : ''} en cours de génération...
                </p>
                <p className="text-sm text-blue-700">
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
          <Card>
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
                  <div key={job.id} className="border rounded-lg p-4 bg-gray-50">
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
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 shadow-lg' 
                          : 'border-gray-300 hover:border-blue-400 hover:shadow-md bg-white'
                        }
                      `}
                    >
                      {/* Checkbox visible */}
                      <div className="absolute top-3 right-3 z-10">
                        <div className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center
                          ${isSelected 
                            ? 'bg-blue-600 border-blue-600' 
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
                        <div className="absolute top-3 left-3 z-10 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
                            {isSelected && <span className="ml-2 text-blue-600">✓ Sélectionné</span>}
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
          <Card className={selectedVideos.length > 0 ? 'border-blue-500 bg-blue-50/50' : ''}>
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
                      <div key={video.id} className="border rounded-lg p-3 bg-gray-50">
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
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={index === selectedVideos.length - 1}
                              className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
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
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="font-medium text-blue-900 mb-1">Prêt à assembler</p>
                    <p className="text-blue-700 text-xs">
                      {includeIntro && 'Intro + '}
                      {selectedVideos.length} segment{selectedVideos.length > 1 ? 's' : ''}
                      {includeOutro && ' + Outro'}
                      {' '}= {(includeIntro ? 1 : 0) + selectedVideos.length + (includeOutro ? 1 : 0)} vidéo{(includeIntro ? 1 : 0) + selectedVideos.length + (includeOutro ? 1 : 0) > 1 ? 's' : ''} au total
                    </p>
                  </div>

                  <Button
                    onClick={mergeSelectedVideos}
                    disabled={isMerging || selectedVideos.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700"
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
                <CardTitle className="text-green-900">✅ Vidéo finale assemblée</CardTitle>
                <CardDescription className="text-green-700">
                  Prête à être publiée
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <video 
                  src={mergedVideoUrl} 
                  controls 
                  className="w-full rounded border-2 border-green-200"
                />
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
                          // Rafraîchir pour voir le changement
                          window.location.href = '/'
                        } else {
                          alert('❌ Erreur lors de la sauvegarde')
                        }
                      } catch (err) {
                        alert('❌ Erreur lors de la sauvegarde')
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!podcastId}
                  >
                    💾 Sauvegarder dans le podcast
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Boutons de navigation */}
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => window.location.href = '/create'}>
          Retour à la création
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Accueil
        </Button>
      </div>
    </div>
    </main>
  )
}

export default function GalleryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#D42E1B]" />
      </div>
    }>
      <GalleryPageContent />
    </Suspense>
  )
}
