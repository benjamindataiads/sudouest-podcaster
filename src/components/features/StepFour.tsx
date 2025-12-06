'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AVAILABLE_AVATARS, AudioChunk } from '@/lib/services/fal'
import { useVideoGeneration } from '@/contexts/VideoGenerationContext'
import { Loader2, Download, X, Film, Images, ChevronDown, ChevronUp } from 'lucide-react'

interface ImageVariation {
  url: string
  label: string
  description?: string
}

interface Avatar {
  id: number
  name: string
  voiceUrl: string
  imageUrl: string
  imageVariations?: ImageVariation[]
  isDefault: boolean
}

interface StepFourProps {
  audioUrl: string
  audioChunks?: AudioChunk[]
  podcastId?: number | null
  avatar?: Avatar | null
  onBack: () => void
  onVideoGenerated?: (videoUrl: string) => Promise<void>
  onVideosGenerated?: (videoUrls: string[]) => Promise<void>
}

export default function StepFour({ 
  audioUrl, 
  audioChunks = [],
  podcastId,
  avatar,
  onBack,
  onVideoGenerated,
  onVideosGenerated 
}: StepFourProps) {
  const router = useRouter()
  const { addJob, updateJobStatus, jobs, isGenerating, refreshJobs } = useVideoGeneration()
  const [selectedAvatar, setSelectedAvatar] = useState<string>('sudouest-default') // Avatar Sud-Ouest par défaut
  const [withCaptions, setWithCaptions] = useState(true)
  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoChunks, setVideoChunks] = useState<string[]>([])
  const [progress, setProgress] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [selectedAudioForVideo, setSelectedAudioForVideo] = useState<number | null>(null)
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set())
  const [realAudioChunks, setRealAudioChunks] = useState<AudioChunk[]>(audioChunks)
  const [audioGenerating, setAudioGenerating] = useState(audioUrl === 'generating')
  const [imagePerChunk, setImagePerChunk] = useState<Record<number, string>>({}) // Track selected image per chunk
  const [showImageSelector, setShowImageSelector] = useState<number | null>(null) // Which chunk has image selector open
  const abortControllerRef = useRef<AbortController | null>(null)
  const audioPollingRef = useRef<NodeJS.Timeout | null>(null)
  
  // Update realAudioChunks when audioChunks prop changes
  useEffect(() => {
    if (audioChunks && audioChunks.length > 0) {
      console.log(`📥 Received ${audioChunks.length} audio chunks from parent`)
      setRealAudioChunks(audioChunks)
      // Check if all chunks have URLs (audio complete)
      const completedChunks = audioChunks.filter(c => c.url)
      if (completedChunks.length === audioChunks.length && audioChunks.length > 0) {
        setAudioGenerating(false)
      }
    }
  }, [audioChunks])
  
  // Update audioGenerating state when audioUrl changes
  useEffect(() => {
    if (audioUrl && audioUrl !== 'generating') {
      setAudioGenerating(false)
    } else if (audioUrl === 'generating') {
      setAudioGenerating(true)
    }
  }, [audioUrl])
  
  const hasMultipleChunks = realAudioChunks && realAudioChunks.length > 1
  // Use avatar image from props, or fallback to default
  const avatarImageUrl = avatar?.imageUrl || 'https://dataiads-test1.fr/sudouest/avatarsudsouest.png'
  const avatarName = avatar?.name || 'Avatar Sud-Ouest'
  
  // Get all available images for selection (original + variations)
  const allAvatarImages: ImageVariation[] = avatar?.imageVariations && avatar.imageVariations.length > 0
    ? avatar.imageVariations
    : [{ url: avatarImageUrl, label: 'original', description: 'Image principale' }]
  
  // Helper to get selected image for a chunk (or default)
  const getImageForChunk = (chunkIndex: number): string => {
    return imagePerChunk[chunkIndex] || avatarImageUrl
  }

  // Charger les jobs au montage
  useEffect(() => {
    if (podcastId) {
      console.log(`📂 Loading video jobs for podcast ${podcastId}`)
      refreshJobs(podcastId)
    }
  }, [podcastId, refreshJobs])

  // Worker: Traiter les audio jobs + polling pour les résultats
  useEffect(() => {
    if (audioGenerating && podcastId) {
      console.log('🎤 Audio is generating, starting worker and polling...')
      
      // Fonction pour traiter les jobs audio
      const processAudioJobs = async () => {
        try {
          const response = await fetch('/api/audio-jobs/process', {
            method: 'POST',
          })
          
          const data = await response.json()
          
          if (data.success) {
            console.log(`✅ Audio job completed`)
            // Le podcast a été mis à jour, recharger
            const podcastRes = await fetch(`/api/podcasts/${podcastId}`)
            if (podcastRes.ok) {
              const podcastData = await podcastRes.json()
              if (podcastData.podcast.audioChunks) {
                setRealAudioChunks(podcastData.podcast.audioChunks)
                setAudioGenerating(false)
              }
            }
          }
        } catch (error) {
          console.error('Audio worker error:', error)
        }
      }
      
      // Démarrer le worker immédiatement
      processAudioJobs()
      
      // Polling pour vérifier l'état
      audioPollingRef.current = setInterval(async () => {
        try {
          const podcastRes = await fetch(`/api/podcasts/${podcastId}`)
          if (podcastRes.ok) {
            const podcastData = await podcastRes.json()
            if (podcastData.podcast.audioChunks && podcastData.podcast.audioChunks.length > 0) {
              const firstChunk = podcastData.podcast.audioChunks[0]
              if (firstChunk.url && firstChunk.url !== '') {
                console.log('✅ Audio ready!')
                setRealAudioChunks(podcastData.podcast.audioChunks)
                setAudioGenerating(false)
                if (audioPollingRef.current) {
                  clearInterval(audioPollingRef.current)
                }
              }
            }
          }
        } catch (error) {
          console.error('Audio polling error:', error)
        }
      }, 3000) // Poll toutes les 3 secondes
      
      return () => {
        if (audioPollingRef.current) {
          clearInterval(audioPollingRef.current)
        }
      }
    }
  }, [audioGenerating, podcastId])

  // Sauvegarder automatiquement les URLs vidéo générées
  useEffect(() => {
    const completedVideos = jobs
      .filter(job => job.status === 'completed' && job.videoUrl)
      .map(job => job.videoUrl!)
      .filter(Boolean)

    if (completedVideos.length > 0 && onVideosGenerated) {
      console.log('💾 Auto-saving video URLs:', completedVideos.length)
      onVideosGenerated(completedVideos).catch(err => {
        console.error('Failed to auto-save videos:', err)
      })
    }
  }, [jobs, onVideosGenerated])

  const toggleChunkSelection = (index: number) => {
    const newSelected = new Set(selectedChunks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedChunks(newSelected)
  }

  const selectAllChunks = () => {
    setSelectedChunks(new Set(audioChunks.map((_, idx) => idx)))
  }

  const deselectAllChunks = () => {
    setSelectedChunks(new Set())
  }

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setProgress('')
    setProgressPercent(0)
  }

  const generateVideoForChunk = async (chunkIndex: number) => {
    if (!selectedAvatar) {
      alert('Veuillez sélectionner un avatar')
      return
    }

    const chunk = realAudioChunks[chunkIndex]
    const selectedImage = getImageForChunk(chunkIndex)
    
    // Créer un job dans la DB (status: queued) with selected image
    await addJob(chunk.url, chunkIndex, chunk.text, chunk.section, podcastId || undefined, selectedImage)
    
    // Rediriger immédiatement vers la galerie
    const galleryUrl = podcastId ? `/gallery?podcastId=${podcastId}` : '/gallery'
    router.push(galleryUrl)
    
    // Le worker côté serveur va traiter le job automatiquement
  }

  const generateSelectedVideos = async () => {
    if (!selectedAvatar) {
      alert('Veuillez sélectionner un avatar')
      return
    }

    if (selectedChunks.size === 0) {
      alert('Veuillez sélectionner au moins un segment audio')
      return
    }

    const selectedIndices = Array.from(selectedChunks).sort((a, b) => a - b)

    // Créer les jobs pour les chunks sélectionnés avec l'image choisie pour chacun
    await Promise.all(selectedIndices.map(async (i) => {
      const chunk = realAudioChunks[i]
      const selectedImage = getImageForChunk(i)
      await addJob(chunk.url, i, chunk.text, chunk.section, podcastId || undefined, selectedImage)
    }))

    console.log(`✅ Created ${selectedIndices.length} video jobs in database`)

    // Rediriger immédiatement vers la galerie
    const galleryUrl = podcastId ? `/gallery?podcastId=${podcastId}` : '/gallery'
    router.push(galleryUrl)
    
    // Le worker côté serveur va traiter les jobs automatiquement
  }

  const generateAllVideos = async () => {
    if (!selectedAvatar) {
      alert('Veuillez sélectionner un avatar')
      return
    }

    // Créer tous les jobs (status: queued) avec l'image choisie pour chaque segment
    // Le worker de la galerie va les traiter via /api/video-jobs/process (webhooks)
    console.log(`📝 Creating ${realAudioChunks.length} video jobs...`)
    
    await Promise.all(realAudioChunks.map(async (chunk, i) => {
      const selectedImage = getImageForChunk(i)
      await addJob(chunk.url, i, chunk.text, chunk.section, podcastId || undefined, selectedImage)
    }))

    console.log(`✅ Created ${realAudioChunks.length} video jobs in database`)

    // Rediriger vers la galerie - le worker va traiter les jobs automatiquement
    const galleryUrl = podcastId ? `/gallery?podcastId=${podcastId}` : '/gallery'
    router.push(galleryUrl)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Génération de la vidéo</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelGeneration}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">{progress}</p>
              <p className="text-sm text-gray-500 mb-4">
                Cela peut prendre plusieurs minutes...
              </p>
            </div>
            
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-center text-gray-500">
                {progressPercent}% complété
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (videoUrl || videoChunks.length > 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>✅ Vidéo générée avec succès !</CardTitle>
            <CardDescription>
              {videoUrl 
                ? 'Votre vidéo podcast est prête' 
                : `${videoChunks.length} segments vidéo générés (assemblage en cours)`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vidéo finale assemblée */}
            {videoUrl && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center">
                  <Film className="mr-2 h-5 w-5" />
                  Vidéo complète MP4
                </h3>
                <video controls src={videoUrl} className="w-full mb-3 rounded" />
                <Button asChild className="w-full">
                  <a href={videoUrl} download="podcast-sudouest.mp4">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger la vidéo (MP4)
                  </a>
                </Button>
              </div>
            )}

            {/* Chunks vidéo individuels */}
            {videoChunks.length > 0 && !videoUrl && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-2">
                  Segments vidéo générés (en attente d&apos;assemblage) :
                </p>
                {videoChunks.map((chunkUrl, idx) => (
                  <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-xs font-medium mb-2">Segment {idx + 1}/{videoChunks.length}</h4>
                    <video controls src={chunkUrl} className="w-full rounded" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Retour à l&apos;accueil
          </Button>
          <Button onClick={() => {
            setVideoUrl('')
            setVideoChunks([])
            setSelectedAvatar('sudouest-default')
          }}>
            Créer une nouvelle vidéo
          </Button>
        </div>
      </div>
    )
  }

  // Use realAudioChunks which is kept in sync with props
  const displayAudioChunks = realAudioChunks
  const completedAudioChunks = displayAudioChunks.filter(c => c.url)
  const totalAudioChunks = displayAudioChunks.length

  return (
    <div className="space-y-6">
      {/* Bannière audio en génération */}
      {audioGenerating && (
        <Card className="border-orange-500 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-900">
                  🎤 Génération audio en cours...
                </p>
                <p className="text-sm text-orange-700">
                  Les fichiers audio apparaîtront ci-dessous dès qu'ils seront prêts. Cela peut prendre 2-3 minutes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bannière de génération vidéo en cours */}
      {isGenerating && (
        <Card className="border-blue-500 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Génération de vidéos en cours...
                  </p>
                  <p className="text-sm text-blue-700">
                    Vous pouvez naviguer librement, les vidéos s'afficheront dans la galerie
                  </p>
                </div>
              </div>
              <Button onClick={() => {
                const galleryUrl = podcastId ? `/gallery?podcastId=${podcastId}` : '/gallery'
                router.push(galleryUrl)
              }} variant="outline">
                Voir la galerie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Banner de génération audio en cours */}
      {audioGenerating && totalAudioChunks > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-800">🎤 Génération audio en cours...</h3>
              <p className="text-sm text-orange-600">
                {completedAudioChunks.length} / {totalAudioChunks} segments terminés
              </p>
              <Progress value={(completedAudioChunks.length / totalAudioChunks) * 100} className="mt-2 h-2" />
            </div>
          </div>
        </div>
      )}
      
      {/* Aperçu de l'audio */}
      <Card>
        <CardHeader>
          <CardTitle>Audio du podcast</CardTitle>
          <CardDescription>
            {audioGenerating ? (
              <span className="text-orange-600">
                ⏳ {completedAudioChunks.length}/{totalAudioChunks} segments générés
              </span>
            ) : totalAudioChunks > 1 ? (
              `${completedAudioChunks.length} segments audio prêts pour la vidéo`
            ) : completedAudioChunks.length > 0 ? (
              'L\'audio qui sera utilisé pour la vidéo'
            ) : (
              <span className="text-gray-400">Aucun audio disponible - en attente de génération</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Un seul audio */}
          {!hasMultipleChunks && !audioGenerating && (
            <audio controls src={audioUrl} className="w-full" />
          )}
          
          {/* Placeholders audio en génération */}
          {audioGenerating && totalAudioChunks > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {displayAudioChunks.map((chunk, idx) => (
                <div key={idx} className={`p-2 rounded flex items-center space-x-3 border ${
                  chunk.url ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <span className={`text-xs font-medium min-w-[60px] ${chunk.url ? 'text-green-600' : 'text-orange-600'}`}>
                    {chunk.url ? '✓' : '⏳'} {idx + 1}/{totalAudioChunks}
                  </span>
                  {chunk.url ? (
                    <audio controls src={chunk.url} className="flex-1 h-8" />
                  ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                      <span className="text-sm text-gray-600 line-clamp-1">{chunk.text?.substring(0, 60)}...</span>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Plusieurs chunks audio générés */}
          {hasMultipleChunks && !audioGenerating && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {displayAudioChunks.map((chunk, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-500 min-w-[60px]">
                    {idx + 1}/{displayAudioChunks.length}
                  </span>
                  <audio controls src={chunk.url} className="flex-1 h-8" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sélection de l'avatar et génération vidéo */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration vidéo</CardTitle>
          <CardDescription>
            Avatar et options pour la génération vidéo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aperçu de l'avatar */}
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="relative">
              <img 
                src={avatarImageUrl} 
                alt={avatarName}
                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
              />
              {allAvatarImages.length > 1 && (
                <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Images className="h-3 w-3" />
                  {allAvatarImages.length}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">{avatarName}</h3>
              <p className="text-sm text-gray-600 mb-3">
                Cet avatar sera utilisé pour générer les vidéos avec lip-sync via VEED Fabric 1.0.
              </p>
              {allAvatarImages.length > 1 && (
                <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg mb-2">
                  <p className="text-xs text-orange-700">
                    <Images className="h-3 w-3 inline mr-1" />
                    <strong>{allAvatarImages.length} variations de pose disponibles.</strong> Vous pouvez choisir une image différente pour chaque segment ci-dessous.
                  </p>
                </div>
              )}
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Modèle: VEED Fabric 1.0</p>
                <p>• Durée max par segment: ~15 secondes</p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="p-3 bg-gray-50 rounded">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={withCaptions}
                onChange={(e) => setWithCaptions(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Ajouter des sous-titres automatiques (assemblage final)</span>
            </label>
          </div>

          {/* Génération par segment */}
              {hasMultipleChunks && !audioGenerating && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Sélectionner les segments à générer :</h4>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={selectAllChunks}
                  >
                    Tout sélectionner
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={deselectAllChunks}
                  >
                    Tout désélectionner
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {realAudioChunks.map((chunk, idx) => {
                  const isSelected = selectedChunks.has(idx)
                  const existingJob = jobs.find(j => j.audioChunkIndex === idx)
                  const selectedImage = getImageForChunk(idx)
                  const hasVariations = allAvatarImages.length > 1
                  
                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-lg transition-all ${
                        isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-300'
                      }`}
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleChunkSelection(idx)}
                          className="w-4 h-4 text-blue-600 rounded"
                          disabled={!!existingJob}
                        />
                        
                        {/* Image thumbnail (clickable if variations available) */}
                        {hasVariations ? (
                          <button
                            type="button"
                            onClick={() => setShowImageSelector(showImageSelector === idx ? null : idx)}
                            className="relative w-10 h-10 rounded overflow-hidden border-2 border-orange-300 hover:border-orange-500 transition-colors flex-shrink-0"
                            title="Changer l'image pour ce segment"
                          >
                            <img src={selectedImage} alt="Avatar" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 right-0 bg-orange-500 p-0.5 rounded-tl">
                              <Images className="h-2.5 w-2.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded overflow-hidden border border-gray-300 flex-shrink-0">
                            <img src={selectedImage} alt="Avatar" className="w-full h-full object-cover" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Segment {idx + 1}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{chunk.text.substring(0, 100)}...</p>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-2">
                          {hasVariations && (
                            <button
                              type="button"
                              onClick={() => setShowImageSelector(showImageSelector === idx ? null : idx)}
                              className="text-orange-600 hover:text-orange-700 p-1"
                              title="Choisir une variation d'image"
                            >
                              {showImageSelector === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                          
                          {existingJob ? (
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {existingJob.status === 'queued' && '⏳ En attente'}
                              {existingJob.status === 'generating' && '🔄 Génération...'}
                              {existingJob.status === 'completed' && '✅ Terminé'}
                              {existingJob.status === 'failed' && '❌ Échec'}
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => generateVideoForChunk(idx)}
                              disabled={generatingIndex === idx || loading}
                            >
                              <Film className="h-4 w-4 mr-1" />
                              Générer
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Image selector dropdown */}
                      {showImageSelector === idx && hasVariations && (
                        <div className="border-t border-gray-200 p-3 bg-orange-50">
                          <p className="text-xs font-medium text-orange-800 mb-2">
                            Choisir une image pour ce segment :
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {allAvatarImages.map((img, imgIdx) => (
                              <button
                                key={imgIdx}
                                type="button"
                                onClick={() => {
                                  setImagePerChunk(prev => ({ ...prev, [idx]: img.url }))
                                  setShowImageSelector(null)
                                }}
                                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                  selectedImage === img.url 
                                    ? 'border-orange-500 ring-2 ring-orange-300' 
                                    : 'border-gray-200 hover:border-orange-300'
                                }`}
                              >
                                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                {selectedImage === img.url && (
                                  <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                                    <div className="bg-orange-500 text-white p-1 rounded-full">
                                      <Images className="h-3 w-3" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-orange-600 mt-2">
                            💡 Utilisez différentes poses pour des transitions naturelles
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {selectedChunks.size > 0 && (
                <Button 
                  onClick={generateSelectedVideos}
                  className="w-full"
                  size="lg"
                >
                  <Film className="h-4 w-4 mr-2" />
                  Générer {selectedChunks.size} vidéo{selectedChunks.size > 1 ? 's' : ''} sélectionnée{selectedChunks.size > 1 ? 's' : ''}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="space-x-3">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Passer cette étape
          </Button>
          <Button onClick={generateAllVideos} size="lg" disabled={!selectedAvatar || loading || audioGenerating || realAudioChunks.length === 0 || !realAudioChunks[0]?.url}>
            {audioGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ⏳ En attente de l'audio...
              </>
            ) : !realAudioChunks[0]?.url ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ⏳ Audio en cours...
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération vidéo...
              </>
            ) : (
              <>
                <Film className="mr-2 h-4 w-4" />
                {hasMultipleChunks ? `Générer toutes les vidéos (${realAudioChunks.length})` : 'Générer la vidéo'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

