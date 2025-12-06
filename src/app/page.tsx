'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import CreatePodcastDialog from '@/components/features/CreatePodcastDialog'
import { Play, Film, Loader2, Plus, Clock, Edit2, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import AuthButtons from '@/components/features/AuthButtons'

interface Podcast {
  id: number
  title: string
  status: string
  currentStep: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  estimatedDuration?: number
  thumbnailUrl?: string
  audioChunks?: unknown[]
  videoUrls?: string[]
  finalVideoUrl?: string
}

// Group podcasts by date
function groupPodcastsByDate(podcasts: Podcast[]): Map<string, Podcast[]> {
  const grouped = new Map<string, Podcast[]>()
  
  podcasts.forEach(podcast => {
    const date = new Date(podcast.createdAt).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const existing = grouped.get(date) || []
    grouped.set(date, [...existing, podcast])
  })
  
  return grouped
}

// Horizontal slider for podcasts of a specific date
function DateSlider({ 
  date, 
  podcasts,
  onDelete,
  deletingId,
  onVideoClick,
  getStatusLabel,
  getStatusColor,
  getStepNumber,
}: {
  date: string
  podcasts: Podcast[]
  onDelete: (id: number) => void
  deletingId: number | null
  onVideoClick: (url: string, title: string) => void
  getStatusLabel: (status: string) => string
  getStatusColor: (status: string) => string
  getStepNumber: (status: string) => number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 320
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }, [])

  return (
    <div className="mb-10">
      {/* Date Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 capitalize flex items-center gap-3">
          <span className="w-1 h-6 bg-[#D42E1B] rounded-full"></span>
          {date}
          <span className="text-sm font-normal text-gray-500">({podcasts.length})</span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Horizontal Scroll Container */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {podcasts.map((podcast) => (
          <PodcastCard
            key={podcast.id}
            podcast={podcast}
            onDelete={onDelete}
            deletingId={deletingId}
            onVideoClick={onVideoClick}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
            getStepNumber={getStepNumber}
          />
        ))}
      </div>
    </div>
  )
}

// Individual Podcast Card
function PodcastCard({
  podcast,
  onDelete,
  deletingId,
  onVideoClick,
  getStatusLabel,
  getStatusColor,
  getStepNumber,
}: {
  podcast: Podcast
  onDelete: (id: number) => void
  deletingId: number | null
  onVideoClick: (url: string, title: string) => void
  getStatusLabel: (status: string) => string
  getStatusColor: (status: string) => string
  getStepNumber: (status: string) => number
}) {
  return (
    <Card className="flex-shrink-0 w-72 overflow-hidden hover:shadow-xl transition-all duration-300 group border-2 border-transparent hover:border-[#D42E1B]/20">
      {/* Video/Thumbnail Preview */}
      <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {podcast.finalVideoUrl ? (
          <video
            src={podcast.finalVideoUrl}
            className="w-full h-full object-cover cursor-pointer"
            muted
            loop
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
            onClick={() => onVideoClick(podcast.finalVideoUrl!, podcast.title)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              podcast.status === 'completed' ? 'bg-green-100' :
              podcast.status.includes('generating') ? 'bg-yellow-100 animate-pulse' :
              'bg-white'
            }`}>
              {podcast.videoUrls?.length ? (
                <Film className="h-8 w-8 text-gray-600" />
              ) : podcast.audioChunks?.length ? (
                <Play className="h-8 w-8 text-gray-600" />
              ) : (
                <Edit2 className="h-8 w-8 text-gray-500" />
              )}
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full shadow-sm ${getStatusColor(podcast.status)}`}>
            {getStatusLabel(podcast.status)}
          </span>
        </div>
        
        {/* Progress Dots */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full ${
                step <= getStepNumber(podcast.status)
                  ? podcast.status.includes('generating') && step === getStepNumber(podcast.status)
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
      
      {/* Card Content */}
      <CardContent className="p-4">
        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]">
          {podcast.title}
        </h4>
        
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
          {podcast.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(podcast.estimatedDuration / 60)} min
            </span>
          )}
          {podcast.finalVideoUrl && (
            <span className="flex items-center gap-1 text-green-600">
              <Film className="h-3.5 w-3.5" />
              Vidéo
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href={`/create?resume=${podcast.id}&step=${getStepNumber(podcast.status)}`} className="flex-1">
            <Button size="sm" className="w-full bg-[#D42E1B] hover:bg-[#B01030] text-white">
              {podcast.status === 'completed' ? 'Voir' : 'Reprendre'}
            </Button>
          </Link>
          {(podcast.audioChunks || podcast.videoUrls) && (
            <Link href={`/gallery?podcastId=${podcast.id}`}>
              <Button size="sm" variant="outline" className="px-3">
                <Film className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(podcast.id)}
            disabled={deletingId === podcast.id}
            className="px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {deletingId === podcast.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Container for all date groups
function PodcastsByDate({
  podcasts,
  onDelete,
  deletingId,
  onVideoClick,
  getStatusLabel,
  getStatusColor,
  getStepNumber,
}: {
  podcasts: Podcast[]
  onDelete: (id: number) => void
  deletingId: number | null
  onVideoClick: (url: string, title: string) => void
  getStatusLabel: (status: string) => string
  getStatusColor: (status: string) => string
  getStepNumber: (status: string) => number
}) {
  const groupedPodcasts = groupPodcastsByDate(podcasts)
  
  return (
    <div className="mb-16">
      <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
        <span className="w-1 h-8 bg-[#D42E1B] mr-3"></span>
        Mes podcasts ({podcasts.length})
      </h3>
      
      {Array.from(groupedPodcasts.entries()).map(([date, datePodcasts]) => (
        <DateSlider
          key={date}
          date={date}
          podcasts={datePodcasts}
          onDelete={onDelete}
          deletingId={deletingId}
          onVideoClick={onVideoClick}
          getStatusLabel={getStatusLabel}
          getStatusColor={getStatusColor}
          getStepNumber={getStepNumber}
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<{url: string, title: string} | null>(null)

  useEffect(() => {
    fetchLatestPodcasts()
  }, [])

  const fetchLatestPodcasts = async () => {
    try {
      const response = await fetch('/api/podcasts/latest')
      if (response.ok) {
        const data = await response.json()
        if (data.podcasts) {
          setPodcasts(data.podcasts)
        }
      }
    } catch (error) {
      console.error('Error fetching podcasts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePodcast = async (podcastId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce podcast ? Cette action est irréversible.')) {
      return
    }

    setDeletingId(podcastId)
    
    try {
      const response = await fetch(`/api/podcasts/${podcastId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPodcasts(podcasts.filter(p => p.id !== podcastId))
      } else {
        const error = await response.json()
        alert(`Erreur: ${error.error || 'Impossible de supprimer le podcast'}`)
      }
    } catch (error) {
      console.error('Error deleting podcast:', error)
      alert('Erreur lors de la suppression du podcast')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '1. Articles',
      articles_selected: '2. Script',
      script_ready: '3. Audio',
      audio_generating: '3. Audio en cours...',
      audio_generated: '4. Vidéo',
      video_generating: '4. Vidéo en cours...',
      video_generated: 'Terminé',
      completed: 'Terminé',
    }
    return labels[status] || status
  }
  
  const getStepNumber = (status: string): number => {
    const steps: Record<string, number> = {
      draft: 1,
      articles_selected: 2,
      script_ready: 3,
      audio_generating: 3,
      audio_generated: 4,
      video_generating: 4,
      video_generated: 4,
      completed: 4,
    }
    return steps[status] || 1
  }

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800'
    if (status.includes('generating')) return 'bg-yellow-100 text-yellow-800'
    if (status.includes('generated')) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header avec logo Sud-Ouest */}
      <div className="bg-[#D42E1B] text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SudOuestLogo width={120} height={40} fill="white" />
              <div className="hidden md:block h-8 w-px bg-white/30" />
              <h1 className="text-2xl md:text-3xl font-bold">Podcaster</h1>
            </div>
            <div className="flex items-center gap-3">
              <AuthButtons />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Hero CTA */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Transformez l&apos;actualité en podcast
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Créez des podcasts audio et vidéo professionnels à partir des articles de Sud-Ouest en quelques clics
          </p>
          <CreatePodcastDialog>
            <Button size="lg" className="bg-[#D42E1B] hover:bg-[#B01030] text-white text-lg px-10 py-6 rounded-full shadow-lg">
              <Plus className="h-5 w-5 mr-2" />
              Créer un nouveau podcast
            </Button>
          </CreatePodcastDialog>
        </div>

        {/* Podcasts List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-[#D42E1B]" />
          </div>
        ) : podcasts.length > 0 ? (
          <PodcastsByDate 
            podcasts={podcasts}
            onDelete={handleDeletePodcast}
            deletingId={deletingId}
            onVideoClick={(url, title) => {
              setSelectedVideo({ url, title })
                                  setVideoDialogOpen(true)
                                }}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
            getStepNumber={getStepNumber}
          />
        ) : (
          <div className="text-center py-12 mb-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Film className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun podcast créé
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre premier podcast en quelques clics
            </p>
            <CreatePodcastDialog>
              <Button className="bg-[#D42E1B] hover:bg-[#B01030]">
                <Plus className="h-4 w-4 mr-2" />
                Créer mon premier podcast
              </Button>
            </CreatePodcastDialog>
          </div>
        )}

        {/* Comment ça marche Section */}
        <div className="mb-16">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mb-4"
          >
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <span className="w-1 h-6 bg-[#D42E1B] mr-3"></span>
              Comment ça marche ?
            </h3>
            {showHowItWorks ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {showHowItWorks && (
            <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-300">
              <Card className="border-2 hover:border-[#D42E1B] transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#D42E1B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📰</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Sélection IA</h3>
                  <p className="text-gray-600 text-sm">
                    Intelligence artificielle pour sélectionner les meilleurs articles
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-[#D42E1B] transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#D42E1B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✍️</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Script éditable</h3>
                  <p className="text-gray-600 text-sm">
                    Générez et personnalisez votre script de podcast
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-[#D42E1B] transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#D42E1B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🎥</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Audio & Vidéo</h3>
                  <p className="text-gray-600 text-sm">
                    Production professionnelle avec voix clonée et avatar
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
          </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SudOuestLogo width={100} height={32} fill="white" className="opacity-80" />
              <span className="text-sm text-gray-400">Podcaster © 2025</span>
            </div>
            <div className="text-sm text-gray-400">
              POC Propulsé par l&apos;IA et Carole Fourcade
            </div>
          </div>
        </div>
      </footer>

      {/* Dialog vidéo */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-lg font-bold text-gray-900">
              {selectedVideo?.title || 'Vidéo finale'}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="bg-black">
              <video 
                src={selectedVideo.url} 
                controls 
                autoPlay
                className="w-full aspect-[9/16] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

