'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import Sidebar from '@/components/layout/Sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Volume2, 
  Save,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  Download,
  Check,
  Sparkles,
  Plus,
  Clock,
  ArrowLeft,
  Mic,
  Trash2,
  Link,
  Globe
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4
type ViewMode = 'list' | 'create'

interface AudioArticle {
  id?: number
  originalText: string
  summaryDuration: string
  summary: string
  audioUrl?: string
  voiceId: string
  title: string
  createdAt?: string
  status?: string
}

interface SavedAudioArticle {
  id: number
  title: string
  summary: string
  audioUrl: string | null
  voice: string // DB column name is still 'voice'
  status: string
  createdAt: string
  summaryDuration: string
}

const DURATION_OPTIONS = [
  { value: '30', label: '~30 secondes' },
  { value: '60', label: '~1 minute' },
  { value: '90', label: '~1 min 30' },
  { value: '120', label: '~2 minutes' },
  { value: '180', label: '~3 minutes' },
]

// MiniMax Speech 2.5 Turbo Voice IDs
const VOICE_OPTIONS = [
  { value: 'Wise_Woman', label: '👩‍🦳 Femme sage (défaut)' },
  { value: 'Calm_Woman', label: '👩 Femme calme' },
  { value: 'Sweet_Girl_2', label: '👧 Fille douce' },
  { value: 'Lively_Girl', label: '💃 Fille vive' },
  { value: 'Exuberant_Girl', label: '🌟 Fille exubérante' },
  { value: 'Lovely_Girl', label: '💕 Fille adorable' },
  { value: 'Inspirational_girl', label: '✨ Fille inspirante' },
  { value: 'Deep_Voice_Man', label: '🎙️ Homme voix grave' },
  { value: 'Patient_Man', label: '👨 Homme patient' },
  { value: 'Determined_Man', label: '💪 Homme déterminé' },
  { value: 'Elegant_Man', label: '🎩 Homme élégant' },
  { value: 'Casual_Guy', label: '😎 Gars décontracté' },
  { value: 'Decent_Boy', label: '👦 Garçon décent' },
  { value: 'Young_Knight', label: '⚔️ Jeune chevalier' },
  { value: 'Friendly_Person', label: '🤗 Personne amicale' },
  { value: 'Imposing_Manner', label: '👔 Manière imposante' },
  { value: 'Abbess', label: '🙏 Abbesse' },
]

export default function AudioArticlePage() {
  const { isLoaded, isSignedIn, orgId } = useAuth()
  
  // View mode: list or create
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [savedArticles, setSavedArticles] = useState<SavedAudioArticle[]>([])
  const [isLoadingArticles, setIsLoadingArticles] = useState(true)
  
  // Creation state
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [article, setArticle] = useState<AudioArticle>({
    originalText: '',
    summaryDuration: '60',
    summary: '',
    voiceId: 'Wise_Woman',
    title: '',
  })
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [articleUrl, setArticleUrl] = useState('')
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  // Fetch saved articles
  const fetchArticles = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return
    
    setIsLoadingArticles(true)
    try {
      const response = await fetch('/api/audio-article/save')
      if (response.ok) {
        const data = await response.json()
        setSavedArticles(data.articles || [])
      }
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setIsLoadingArticles(false)
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchArticles()
    }
  }, [isLoaded, isSignedIn, orgId, fetchArticles])

  // Scrape article from URL
  const handleScrapeUrl = async () => {
    if (!articleUrl.trim()) {
      alert('Veuillez entrer une URL')
      return
    }

    setIsScraping(true)
    try {
      const response = await fetch('/api/audio-article/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du scraping')
      }

      setArticle(prev => ({
        ...prev,
        originalText: data.text,
        title: data.title || '',
      }))
      setArticleUrl('') // Clear URL after success
    } catch (error) {
      console.error('Error scraping:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors du scraping')
    } finally {
      setIsScraping(false)
    }
  }

  // Reset creation state when switching to create mode
  const startCreation = () => {
    setArticle({
      originalText: '',
      summaryDuration: '60',
      summary: '',
      voiceId: 'Wise_Woman',
      title: '',
    })
    setArticleUrl('')
    setCurrentStep(1)
    setViewMode('create')
  }

  // Go back to list
  const backToList = () => {
    setViewMode('list')
    fetchArticles() // Refresh list
  }

  // Step 1: Generate summary with OpenAI
  const handleGenerateSummary = async () => {
    if (!article.originalText.trim()) {
      alert('Veuillez coller le texte de l\'article')
      return
    }

    setIsGeneratingSummary(true)
    try {
      const response = await fetch('/api/audio-article/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: article.originalText,
          duration: article.summaryDuration,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du résumé')
      }

      const data = await response.json()
      setArticle(prev => ({ 
        ...prev, 
        summary: data.summary,
        title: data.title || 'Article sans titre',
      }))
      setCurrentStep(2)
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Erreur lors de la génération du résumé')
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // Step 3: Generate audio with Fal.ai Chatterbox
  const handleGenerateAudio = async () => {
    if (!article.summary.trim()) {
      alert('Le résumé est vide')
      return
    }

    setIsGeneratingAudio(true)
    try {
      const response = await fetch('/api/audio-article/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: article.summary,
          voiceId: article.voiceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération audio')
      }

      const data = await response.json()
      setArticle(prev => ({ ...prev, audioUrl: data.audioUrl }))
      setCurrentStep(4)
    } catch (error) {
      console.error('Error generating audio:', error)
      alert('Erreur lors de la génération audio')
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  // Step 4: Save audio article
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/audio-article/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      const data = await response.json()
      setArticle(prev => ({ ...prev, id: data.id }))
      
      // Go back to list after save
      setTimeout(() => {
        backToList()
      }, 1000)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Audio playback for creation
  const togglePlayback = () => {
    if (!article.audioUrl) return

    if (audioElement) {
      if (playingId === -1) {
        audioElement.pause()
        setPlayingId(null)
      } else {
        audioElement.play()
        setPlayingId(-1)
      }
    } else {
      const audio = new Audio(article.audioUrl)
      audio.onended = () => setPlayingId(null)
      audio.play()
      setAudioElement(audio)
      setPlayingId(-1)
    }
  }

  // Delete audio article
  const handleDeleteArticle = async (articleId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet Audio Article ?')) {
      return
    }

    try {
      const response = await fetch(`/api/audio-article/save?id=${articleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression')
      }

      // Remove from local state
      setSavedArticles(prev => prev.filter(a => a.id !== articleId))
      
      // Stop audio if playing
      if (playingId === articleId && audioElement) {
        audioElement.pause()
        setPlayingId(null)
      }
    } catch (error) {
      console.error('Error deleting article:', error)
      alert('Erreur lors de la suppression')
    }
  }

  // Audio playback for list items
  const playArticleAudio = (articleItem: SavedAudioArticle) => {
    if (!articleItem.audioUrl) return

    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }

    if (playingId === articleItem.id) {
      setPlayingId(null)
      return
    }

    const audio = new Audio(articleItem.audioUrl)
    audio.onended = () => setPlayingId(null)
    audio.play()
    setAudioElement(audio)
    setPlayingId(articleItem.id)
  }

  const steps = [
    { num: 1, label: 'Article', icon: <FileText className="h-4 w-4" /> },
    { num: 2, label: 'Résumé', icon: <Sparkles className="h-4 w-4" /> },
    { num: 3, label: 'Audio', icon: <Volume2 className="h-4 w-4" /> },
    { num: 4, label: 'Synthèse', icon: <Save className="h-4 w-4" /> },
  ]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-secondary)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-accent)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-secondary)' }}>
      <Sidebar />
      
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <>
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
                  Audio Articles
                </h1>
                <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                  Transformez vos articles en résumés audio
                </p>
              </div>

              {/* Create Banner */}
              <Card 
                className="mb-8 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={startCreation}
              >
                <div 
                  className="p-6 flex items-center gap-6"
                  style={{ background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, black))' }}
                >
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <Plus className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">
                      Créer un Audio Article
                    </h2>
                    <p className="text-white/80 text-sm">
                      Collez un article, résumez-le avec l'IA, et générez un audio de qualité
                    </p>
                  </div>
                  <ChevronRight className="h-6 w-6 text-white/60" />
                </div>
              </Card>

              {/* Articles List */}
              {isLoadingArticles ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-accent)' }} />
                </div>
              ) : savedArticles.length === 0 ? (
                <Card className="text-center py-12">
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--brand-secondary)' }}
                  >
                    <Mic className="h-8 w-8" style={{ color: 'var(--brand-text)', opacity: 0.4 }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: 'var(--brand-text)' }}>
                    Aucun Audio Article
                  </p>
                  <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                    Créez votre premier audio article en cliquant sur le bouton ci-dessus
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedArticles.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardContent className="p-0">
                        {/* Audio Player Header */}
                        {item.audioUrl && (
                          <div 
                            className="p-4 flex items-center gap-4"
                            style={{ backgroundColor: 'var(--brand-accent)' }}
                          >
                            <button
                              onClick={() => playArticleAudio(item)}
                              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
                              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                            >
                              {playingId === item.id ? (
                                <Pause className="h-6 w-6 text-white" />
                              ) : (
                                <Play className="h-6 w-6 text-white ml-0.5" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{item.title}</p>
                              <p className="text-white/70 text-xs">
                                {VOICE_OPTIONS.find(v => v.value === item.voice)?.label || item.voice}
                              </p>
                            </div>
                            <a
                              href={item.audioUrl}
                              download={`${item.title}.mp3`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-full hover:bg-white/20 transition-colors"
                            >
                              <Download className="h-5 w-5 text-white" />
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteArticle(item.id)
                              }}
                              className="p-2 rounded-full hover:bg-red-500/50 transition-colors"
                            >
                              <Trash2 className="h-5 w-5 text-white" />
                            </button>
                          </div>
                        )}

                        {/* Content */}
                        <div className="p-4">
                          {!item.audioUrl && (
                            <h3 className="font-semibold mb-2 truncate" style={{ color: 'var(--brand-text)' }}>
                              {item.title}
                            </h3>
                          )}
                          <p 
                            className="text-sm line-clamp-3 mb-3"
                            style={{ color: 'var(--brand-text)', opacity: 0.7 }}
                          >
                            {item.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(item.createdAt)}</span>
                              <span className="mx-1">•</span>
                              <span>~{item.summaryDuration}s</span>
                            </div>
                            {!item.audioUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteArticle(item.id)
                                }}
                                className="p-1.5 rounded-full hover:bg-red-100 transition-colors"
                                style={{ color: 'var(--brand-text)', opacity: 0.5 }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CREATE VIEW */}
          {viewMode === 'create' && (
            <>
              {/* Back Button */}
              <Button 
                variant="ghost" 
                onClick={backToList}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour aux articles
              </Button>

              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
                  Créer un Audio Article
                </h1>
                <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                  Transformez votre article en résumé audio
                </p>
              </div>

              {/* Progress Steps */}
              <div className="mb-8">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                  {steps.map((step, idx) => (
                    <div key={step.num} className="flex items-center">
                      <div 
                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                          currentStep >= step.num ? 'font-medium' : 'opacity-50'
                        }`}
                        style={{
                          backgroundColor: currentStep >= step.num ? 'var(--brand-accent)' : 'var(--brand-primary)',
                          color: currentStep >= step.num ? 'white' : 'var(--brand-text)',
                        }}
                      >
                        {step.icon}
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {idx < steps.length - 1 && (
                        <ChevronRight className="h-5 w-5 mx-2" style={{ color: 'var(--brand-text)', opacity: 0.3 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <Card className="max-w-4xl mx-auto">
                <CardContent className="p-6">
                  
                  {/* Step 1: Input Article */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>
                          Étape 1 : Importez votre article
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                          Importez depuis une URL ou copiez-collez le texte manuellement
                        </p>
                      </div>

                      {/* URL Scraping Option */}
                      <div 
                        className="p-4 rounded-lg border"
                        style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'rgba(var(--brand-accent-rgb), 0.05)' }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="h-5 w-5" style={{ color: 'var(--brand-accent)' }} />
                          <Label className="font-medium" style={{ color: 'var(--brand-text)' }}>
                            Importer depuis une URL
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={articleUrl}
                            onChange={(e) => setArticleUrl(e.target.value)}
                            placeholder="https://example.com/article..."
                            className="flex-1"
                            disabled={isScraping}
                          />
                          <Button
                            onClick={handleScrapeUrl}
                            disabled={!articleUrl.trim() || isScraping}
                            variant="outline"
                          >
                            {isScraping ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Extraction...
                              </>
                            ) : (
                              <>
                                <Link className="h-4 w-4 mr-2" />
                                Extraire
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>
                          Fonctionne avec la plupart des sites d'actualités
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--brand-secondary)' }} />
                        <span className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>ou</span>
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--brand-secondary)' }} />
                      </div>

                      {/* Manual Text Input */}
                      <div>
                        <Label>Texte de l'article</Label>
                        <Textarea
                          value={article.originalText}
                          onChange={(e) => setArticle(prev => ({ ...prev, originalText: e.target.value }))}
                          placeholder="Collez le texte de votre article ici..."
                          className="mt-2 min-h-[250px]"
                        />
                        <p className="text-xs mt-2" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>
                          {article.originalText.length} caractères
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Durée cible du résumé</Label>
                          <Select
                            value={article.summaryDuration}
                            onValueChange={(value) => setArticle(prev => ({ ...prev, summaryDuration: value }))}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={handleGenerateSummary}
                          disabled={!article.originalText.trim() || isGeneratingSummary}
                        >
                          {isGeneratingSummary ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Génération...
                            </>
                          ) : (
                            <>
                              Générer le résumé
                              <ChevronRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Edit Summary */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>
                          Étape 2 : Éditez le résumé
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                          Modifiez le résumé généré si nécessaire
                        </p>
                      </div>

                      <div>
                        <Label>Titre</Label>
                        <Input
                          value={article.title}
                          onChange={(e) => setArticle(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Titre de l'article"
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label>Résumé</Label>
                        <Textarea
                          value={article.summary}
                          onChange={(e) => setArticle(prev => ({ ...prev, summary: e.target.value }))}
                          placeholder="Le résumé de l'article..."
                          className="mt-2 min-h-[200px]"
                        />
                        <p className="text-xs mt-2" style={{ color: 'var(--brand-text)', opacity: 0.5 }}>
                          {article.summary.length} caractères (~{Math.ceil(article.summary.length / 150)} secondes de lecture)
                        </p>
                      </div>

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setCurrentStep(1)}>
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Retour
                        </Button>
                        <Button onClick={() => setCurrentStep(3)}>
                          Continuer
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Generate Audio */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>
                          Étape 3 : Générer l'audio
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                          Choisissez la langue et générez l'audio du résumé
                        </p>
                      </div>

                      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-secondary)' }}>
                        <h3 className="font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
                          Résumé à convertir :
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.8 }}>
                          {article.summary}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Voix</Label>
                          <Select
                            value={article.voiceId}
                            onValueChange={(value) => setArticle(prev => ({ ...prev, voiceId: value }))}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VOICE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setCurrentStep(2)}>
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Retour
                        </Button>
                        <Button
                          onClick={handleGenerateAudio}
                          disabled={isGeneratingAudio}
                        >
                          {isGeneratingAudio ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Génération audio...
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-4 w-4 mr-2" />
                              Générer l'audio
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Synthesis & Save */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>
                          Étape 4 : Synthèse finale
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                          Vérifiez et sauvegardez votre Audio Article
                        </p>
                      </div>

                      {/* Title */}
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold" style={{ color: 'var(--brand-text)' }}>
                          {article.title}
                        </h3>
                      </div>

                      {/* Audio Player */}
                      {article.audioUrl && (
                        <div 
                          className="p-6 rounded-xl text-center"
                          style={{ backgroundColor: 'var(--brand-accent)', color: 'white' }}
                        >
                          <button
                            onClick={togglePlayback}
                            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform hover:scale-105"
                            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                          >
                            {playingId === -1 ? (
                              <Pause className="h-10 w-10" />
                            ) : (
                              <Play className="h-10 w-10 ml-1" />
                            )}
                          </button>
                          <p className="font-medium">Écouter le résumé audio</p>
                          
                          <div className="mt-4">
                            <a
                              href={article.audioUrl}
                              download={`${article.title}.wav`}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                            >
                              <Download className="h-4 w-4" />
                              Télécharger l'audio
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      <div>
                        <h4 className="font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
                          Résumé :
                        </h4>
                        <div 
                          className="p-4 rounded-lg"
                          style={{ backgroundColor: 'var(--brand-secondary)' }}
                        >
                          <p style={{ color: 'var(--brand-text)' }}>{article.summary}</p>
                        </div>
                      </div>

                      {/* Original Article (collapsed) */}
                      <details className="group">
                        <summary 
                          className="cursor-pointer font-medium py-2"
                          style={{ color: 'var(--brand-text)' }}
                        >
                          Voir l'article original
                        </summary>
                        <div 
                          className="p-4 rounded-lg mt-2 max-h-48 overflow-y-auto"
                          style={{ backgroundColor: 'var(--brand-secondary)' }}
                        >
                          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--brand-text)', opacity: 0.8 }}>
                            {article.originalText}
                          </p>
                        </div>
                      </details>

                      {/* Actions */}
                      <div className="flex justify-between pt-4">
                        <Button variant="outline" onClick={() => setCurrentStep(3)}>
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Retour
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={isSaving || !!article.id}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sauvegarde...
                            </>
                          ) : article.id ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Sauvegardé
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Sauvegarder
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            </>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-6" style={{ borderTop: '1px solid var(--brand-secondary)' }}>
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--brand-text)', opacity: 0.4 }}>
              <span>Video Creator © 2025</span>
              <span>POC Propulsé par l'IA et Carole Fourcade</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
