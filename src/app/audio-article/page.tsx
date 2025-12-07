'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import Sidebar from '@/components/layout/Sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  Newspaper, 
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
  Sparkles
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface AudioArticle {
  id?: number
  originalText: string
  summaryDuration: string
  summary: string
  audioUrl?: string
  voice: string
  title: string
}

const DURATION_OPTIONS = [
  { value: '30', label: '~30 secondes' },
  { value: '60', label: '~1 minute' },
  { value: '90', label: '~1 min 30' },
  { value: '120', label: '~2 minutes' },
  { value: '180', label: '~3 minutes' },
]

const VOICE_OPTIONS = [
  { value: 'french', label: 'Français' },
  { value: 'english', label: 'Anglais' },
  { value: 'german', label: 'Allemand' },
  { value: 'spanish', label: 'Espagnol' },
  { value: 'italian', label: 'Italien' },
  { value: 'portuguese', label: 'Portugais' },
  { value: 'dutch', label: 'Néerlandais' },
  { value: 'arabic', label: 'Arabe' },
  { value: 'chinese', label: 'Chinois' },
  { value: 'japanese', label: 'Japonais' },
  { value: 'korean', label: 'Coréen' },
]

export default function AudioArticlePage() {
  const { isLoaded, isSignedIn } = useAuth()
  
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [article, setArticle] = useState<AudioArticle>({
    originalText: '',
    summaryDuration: '60',
    summary: '',
    voice: 'french',
    title: '',
  })
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

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
          voice: article.voice,
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
      alert('Audio Article sauvegardé avec succès!')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Audio playback
  const togglePlayback = () => {
    if (!article.audioUrl) return

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause()
      } else {
        audioElement.play()
      }
      setIsPlaying(!isPlaying)
    } else {
      const audio = new Audio(article.audioUrl)
      audio.onended = () => setIsPlaying(false)
      audio.play()
      setAudioElement(audio)
      setIsPlaying(true)
    }
  }

  const steps = [
    { num: 1, label: 'Article', icon: <FileText className="h-4 w-4" /> },
    { num: 2, label: 'Résumé', icon: <Sparkles className="h-4 w-4" /> },
    { num: 3, label: 'Audio', icon: <Volume2 className="h-4 w-4" /> },
    { num: 4, label: 'Synthèse', icon: <Save className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-secondary)' }}>
      <Sidebar />
      
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
              Audio Article
            </h1>
            <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
              Transformez vos articles en résumés audio
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
                      Étape 1 : Collez votre article
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                      Copiez-collez le texte de l'article que vous souhaitez résumer
                    </p>
                  </div>

                  <div>
                    <Label>Texte de l'article</Label>
                    <Textarea
                      value={article.originalText}
                      onChange={(e) => setArticle(prev => ({ ...prev, originalText: e.target.value }))}
                      placeholder="Collez le texte de votre article ici..."
                      className="mt-2 min-h-[300px]"
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
                      <Label>Langue de la voix</Label>
                      <Select
                        value={article.voice}
                        onValueChange={(value) => setArticle(prev => ({ ...prev, voice: value }))}
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
                        {isPlaying ? (
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

