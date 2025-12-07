'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Sidebar from '@/components/layout/Sidebar'
import CreatePodcastDialog from '@/components/features/CreatePodcastDialog'
import { Play, Film, Loader2, Plus, Clock, Edit2, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, Mic } from 'lucide-react'

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
    <div className="mb-8">
      {/* Date Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium capitalize flex items-center gap-3" style={{ color: 'var(--brand-text)' }}>
          <span className="w-1 h-5 rounded-full" style={{ backgroundColor: 'var(--brand-accent)' }}></span>
          {date}
          <span className="text-sm font-normal" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>({podcasts.length})</span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full shadow-sm hover:opacity-80 transition-colors"
            style={{ backgroundColor: 'var(--brand-primary)', border: '1px solid var(--brand-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--brand-text)', opacity: 0.6 }} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full shadow-sm hover:opacity-80 transition-colors"
            style={{ backgroundColor: 'var(--brand-primary)', border: '1px solid var(--brand-secondary)' }}
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--brand-text)', opacity: 0.6 }} />
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
    <Card className="flex-shrink-0 w-72 overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Video/Thumbnail Preview */}
      <div className="relative h-40 overflow-hidden" style={{ backgroundColor: 'var(--brand-secondary)' }}>
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
            <div 
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                podcast.status.includes('generating') ? 'animate-pulse' : ''
              }`}
              style={{ 
                backgroundColor: podcast.status === 'completed' ? '#dcfce7' : 'var(--brand-primary)',
                border: podcast.status === 'completed' ? 'none' : '1px solid var(--brand-secondary)'
              }}
            >
              {podcast.videoUrls?.length ? (
                <Film className="h-8 w-8" style={{ color: 'var(--brand-text)', opacity: 0.5 }} />
              ) : podcast.audioChunks?.length ? (
                <Play className="h-8 w-8" style={{ color: 'var(--brand-text)', opacity: 0.5 }} />
              ) : (
                <Edit2 className="h-8 w-8" style={{ color: 'var(--brand-text)', opacity: 0.4 }} />
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
        <div className="absolute bottom-3 left-3 flex items-center gap-1 backdrop-blur-sm rounded-full px-2 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid var(--brand-secondary)' }}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full ${
                podcast.status.includes('generating') && step === getStepNumber(podcast.status)
                  ? 'bg-yellow-500 animate-pulse'
                  : ''
              }`}
              style={{
                backgroundColor: step <= getStepNumber(podcast.status)
                  ? (podcast.status.includes('generating') && step === getStepNumber(podcast.status) ? undefined : 'var(--brand-accent)')
                  : 'var(--brand-secondary)'
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Card Content */}
      <CardContent className="p-4">
        <h4 className="font-semibold mb-2 line-clamp-2 min-h-[2.5rem]" style={{ color: 'var(--brand-text)' }}>
          {podcast.title}
        </h4>
        
        <div className="flex items-center gap-3 text-sm mb-4" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
          {podcast.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(podcast.estimatedDuration / 60)} min
            </span>
          )}
          {podcast.finalVideoUrl && (
            <span className="flex items-center gap-1" style={{ color: 'var(--brand-accent)' }}>
              <Film className="h-3.5 w-3.5" />
              Vidéo
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href={`/create?resume=${podcast.id}&step=${getStepNumber(podcast.status)}`} className="flex-1">
            <Button size="sm" className="w-full">
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
            className="px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
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
    <div>
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
  const { isLoaded, isSignedIn, orgId } = useAuth()
  const [podcasts, setPodcasts] = useState<Podcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<{url: string, title: string} | null>(null)

  const fetchLatestPodcasts = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false)
      return
    }
    
    setLoading(true)
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
  }, [isLoaded, isSignedIn])

  // Fetch when auth is ready or org changes
  useEffect(() => {
    if (isLoaded) {
      fetchLatestPodcasts()
    }
  }, [isLoaded, isSignedIn, orgId, fetchLatestPodcasts])

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
    if (status === 'completed') return 'bg-green-100 text-green-700'
    if (status.includes('generating')) return 'bg-yellow-100 text-yellow-700'
    if (status.includes('generated')) return 'bg-purple-100 text-purple-700'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-secondary)' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>Mes Avatar Shorts</h1>
            <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>Créez et gérez vos vidéos courtes avec avatar IA</p>
          </div>

          {/* Create CTA */}
          <div className="mb-8 p-6 rounded-xl shadow-sm" style={{ backgroundColor: 'var(--brand-primary)', border: '1px solid var(--brand-secondary)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--brand-accent)', opacity: 0.15 }}>
                  <Mic className="h-6 w-6" style={{ color: 'var(--brand-accent)' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--brand-text)' }}>Créer un nouveau short</h2>
                  <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>Transformez l'actualité en vidéo courte avec avatar</p>
                </div>
              </div>
              <CreatePodcastDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau short
                </Button>
              </CreatePodcastDialog>
            </div>
          </div>

          {/* Podcasts List */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
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
            <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--brand-primary)', border: '1px solid var(--brand-secondary)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--brand-secondary)' }}>
                <Film className="h-8 w-8" style={{ color: 'var(--brand-text)', opacity: 0.4 }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>
                Aucun short créé
              </h3>
              <p className="mb-6" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                Créez votre premier avatar short en quelques clics
              </p>
              <CreatePodcastDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer mon premier short
                </Button>
              </CreatePodcastDialog>
            </div>
          )}

          {/* Comment ça marche Section */}
          <div className="mt-8">
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)', border: '1px solid var(--brand-secondary)' }}
            >
              <h3 className="font-semibold flex items-center" style={{ color: 'var(--brand-text)' }}>
                <span className="w-1 h-5 mr-3 rounded-full" style={{ backgroundColor: 'var(--brand-accent)' }}></span>
                Comment ça marche ?
              </h3>
              {showHowItWorks ? (
                <ChevronUp className="h-5 w-5" style={{ color: 'var(--brand-text)', opacity: 0.5 }} />
              ) : (
                <ChevronDown className="h-5 w-5" style={{ color: 'var(--brand-text)', opacity: 0.5 }} />
              )}
            </button>

            {showHowItWorks && (
              <div className="grid md:grid-cols-3 gap-4 mt-4 animate-in fade-in duration-300">
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--brand-accent)', opacity: 0.15 }}>
                      <span className="text-2xl">📰</span>
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>Sélection IA</h3>
                    <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                      L'IA sélectionne les meilleurs articles
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--brand-accent)', opacity: 0.15 }}>
                      <span className="text-2xl">✍️</span>
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>Script éditable</h3>
                    <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                      Personnalisez votre script vidéo
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--brand-accent)', opacity: 0.15 }}>
                      <span className="text-2xl">🎥</span>
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>Audio & Vidéo</h3>
                    <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                      Production avec voix clonée et avatar
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-6" style={{ borderTop: '1px solid var(--brand-secondary)' }}>
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--brand-text)', opacity: 0.4 }}>
              <span>Video Creator © 2025</span>
              <span>POC Propulsé par l'IA et Carole Fourcade</span>
            </div>
          </footer>
        </div>
      </main>

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
    </div>
  )
}
