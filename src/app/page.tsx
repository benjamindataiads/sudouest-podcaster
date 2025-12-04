'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import CreatePodcastDialog from '@/components/features/CreatePodcastDialog'
import { Play, Film, Loader2, Plus, Clock, Calendar, Edit2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
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
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-1 h-8 bg-[#D42E1B] mr-3"></span>
                Mes podcasts ({podcasts.length})
              </div>
            </h3>
            
            {/* Podcasts Table */}
            <Card className="overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Podcast
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        Durée
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                        Résultat
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {podcasts.map((podcast) => (
                      <tr key={podcast.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {podcast.finalVideoUrl ? (
                              <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-black border-2 border-gray-200">
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
                                  onClick={(e) => {
                                    if (e.currentTarget.paused) {
                                      e.currentTarget.play()
                                    } else {
                                      e.currentTarget.pause()
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                podcast.status === 'completed' ? 'bg-green-100' :
                                podcast.status.includes('generating') ? 'bg-yellow-100' :
                                'bg-gray-100'
                              }`}>
                                {podcast.videoUrls?.length ? (
                                  <Film className="h-5 w-5 text-gray-700" />
                                ) : podcast.audioChunks?.length ? (
                                  <Play className="h-5 w-5 text-gray-700" />
                                ) : (
                                  <Edit2 className="h-5 w-5 text-gray-700" />
                                )}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{podcast.title}</p>
                              <p className="text-sm text-gray-500 sm:hidden">
                                {new Date(podcast.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((step) => (
                                <div
                                  key={step}
                                  className={`w-2 h-2 rounded-full ${
                                    step <= getStepNumber(podcast.status)
                                      ? podcast.status.includes('generating') && step === getStepNumber(podcast.status)
                                        ? 'bg-yellow-500 animate-pulse'
                                        : 'bg-green-500'
                                      : 'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(podcast.status)}`}>
                            {getStatusLabel(podcast.status)}
                          </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                          {new Date(podcast.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                          {podcast.estimatedDuration ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.floor(podcast.estimatedDuration / 60)} min
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          {podcast.finalVideoUrl ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedVideo({url: podcast.finalVideoUrl!, title: podcast.title})
                                  setVideoDialogOpen(true)
                                }}
                                className="w-16 h-16 rounded-lg overflow-hidden bg-black border-2 border-green-200 hover:border-green-400 transition-all cursor-pointer group"
                              >
                                <video 
                                  src={podcast.finalVideoUrl} 
                                  className="w-full h-full object-cover"
                                  muted
                                  loop
                                  onMouseEnter={(e) => e.currentTarget.play()}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.pause()
                                    e.currentTarget.currentTime = 0
                                  }}
                                />
                              </button>
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                ✓ Finale
                              </span>
                            </div>
                          ) : podcast.status === 'completed' ? (
                            <span className="text-xs text-gray-400">Non assemblée</span>
                          ) : (
                            <span className="text-xs text-gray-400">En cours...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/create?resume=${podcast.id}&step=${getStepNumber(podcast.status)}`}>
                              <Button size="sm" variant="outline">
                                {podcast.status === 'completed' ? 'Voir' : 'Reprendre'}
                              </Button>
                            </Link>
                            {(podcast.audioChunks || podcast.videoUrls) && (
                              <Link href={`/gallery?podcastId=${podcast.id}`}>
                                <Button size="sm" variant="ghost">
                                  <Film className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDeletePodcast(podcast.id)}
                              disabled={deletingId === podcast.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingId === podcast.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
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
              <span className="text-sm text-gray-400">Podcaster © 2024</span>
            </div>
            <div className="text-sm text-gray-400">
              Propulsé par l&apos;IA
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

