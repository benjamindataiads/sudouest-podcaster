'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import Sidebar from '@/components/layout/Sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Loader2, 
  Upload, 
  Sparkles, 
  Play, 
  Trash2, 
  Film,
  Image as ImageIcon,
  Settings,
  ChevronRight
} from 'lucide-react'

interface VideoSettings {
  introVideoUrl?: string
  outroVideoUrl?: string
  introImageUrl?: string
  outroImageUrl?: string
  introPrompt?: string
  outroPrompt?: string
}

interface GenerationParams {
  imageUrl: string
  prompt: string
  aspectRatio: '9:16' | '16:9'
  duration: '4s' | '6s' | '8s'
  generateAudio: boolean
  resolution: '720p' | '1080p'
}

const DEFAULT_INTRO_PROMPT = `Animation cinématique d'ouverture pour un podcast. 
La caméra effectue un lent zoom avant sur le logo/image.
Transition fluide avec un léger mouvement de particules.
Ambiance professionnelle et moderne.`

const DEFAULT_OUTRO_PROMPT = `Animation cinématique de fermeture pour un podcast.
La caméra effectue un lent zoom arrière avec un fondu élégant.
Texte "Merci d'avoir regardé" apparaît subtilement.
Transition douce vers le noir.`

export default function VideoSettingsPage() {
  const { isLoaded, isSignedIn, orgId } = useAuth()
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({})
  const [isLoading, setIsLoading] = useState(true)
  
  // Generation state
  const [isGeneratingIntro, setIsGeneratingIntro] = useState(false)
  const [isGeneratingOutro, setIsGeneratingOutro] = useState(false)
  const [generationMessage, setGenerationMessage] = useState('')
  
  // Upload refs
  const introUploadRef = useRef<HTMLInputElement>(null)
  const outroUploadRef = useRef<HTMLInputElement>(null)
  const introImageRef = useRef<HTMLInputElement>(null)
  const outroImageRef = useRef<HTMLInputElement>(null)
  
  // Generation params
  const [introParams, setIntroParams] = useState<GenerationParams>({
    imageUrl: '',
    prompt: DEFAULT_INTRO_PROMPT,
    aspectRatio: '9:16',
    duration: '4s',
    generateAudio: true,
    resolution: '720p',
  })
  
  const [outroParams, setOutroParams] = useState<GenerationParams>({
    imageUrl: '',
    prompt: DEFAULT_OUTRO_PROMPT,
    aspectRatio: '9:16',
    duration: '4s',
    generateAudio: true,
    resolution: '720p',
  })

  // Active tab
  const [activeTab, setActiveTab] = useState<'intro' | 'outro'>('intro')

  // Fetch video settings
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) return
    
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/video')
        if (response.ok) {
          const data = await response.json()
          setVideoSettings(data.videoSettings || {})
          
          // Pre-fill generation params if available
          if (data.videoSettings?.introImageUrl) {
            setIntroParams(prev => ({
              ...prev,
              imageUrl: data.videoSettings.introImageUrl,
              prompt: data.videoSettings.introPrompt || DEFAULT_INTRO_PROMPT,
            }))
          }
          if (data.videoSettings?.outroImageUrl) {
            setOutroParams(prev => ({
              ...prev,
              imageUrl: data.videoSettings.outroImageUrl,
              prompt: data.videoSettings.outroPrompt || DEFAULT_OUTRO_PROMPT,
            }))
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSettings()
  }, [isLoaded, isSignedIn, orgId])

  // Handle video upload
  const handleVideoUpload = async (file: File, type: 'intro' | 'outro') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    try {
      const response = await fetch('/api/settings/video/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      setVideoSettings(prev => ({
        ...prev,
        ...(type === 'intro' 
          ? { introVideoUrl: data.videoUrl, introImageUrl: undefined, introPrompt: undefined }
          : { outroVideoUrl: data.videoUrl, outroImageUrl: undefined, outroPrompt: undefined }
        ),
      }))
      
      alert(`✅ ${type === 'intro' ? 'Intro' : 'Outro'} uploadée avec succès !`)
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Upload failed'}`)
    }
  }

  // Handle image upload for AI generation
  const handleImageUpload = async (file: File, type: 'intro' | 'outro') => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/settings/video/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Image upload failed')
      }

      const data = await response.json()
      
      if (type === 'intro') {
        setIntroParams(prev => ({ ...prev, imageUrl: data.url }))
      } else {
        setOutroParams(prev => ({ ...prev, imageUrl: data.url }))
      }
    } catch (error) {
      console.error('Image upload error:', error)
      alert(`Erreur lors de l'upload de l'image: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    }
  }

  // Generate video with Veo 3.1
  const handleGenerate = async (type: 'intro' | 'outro') => {
    const params = type === 'intro' ? introParams : outroParams
    
    if (!params.imageUrl) {
      alert('Veuillez d\'abord uploader une image')
      return
    }

    if (!params.prompt.trim()) {
      alert('Veuillez entrer un prompt')
      return
    }

    const setGenerating = type === 'intro' ? setIsGeneratingIntro : setIsGeneratingOutro
    setGenerating(true)
    setGenerationMessage('Préparation de la génération...')

    // Progress messages
    const messages = [
      'Préparation de la génération...',
      'Envoi de l\'image à Veo 3.1...',
      'Analyse de l\'image...',
      'Génération de la vidéo...',
      'Application des animations...',
      'Rendu final...',
    ]
    let msgIndex = 0
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length
      setGenerationMessage(messages[msgIndex])
    }, 5000)

    try {
      const response = await fetch('/api/video/generate-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: params.imageUrl,
          prompt: params.prompt,
          type,
          aspectRatio: params.aspectRatio,
          duration: params.duration,
          generateAudio: params.generateAudio,
          resolution: params.resolution,
        }),
      })

      clearInterval(interval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Generation failed')
      }

      const data = await response.json()
      setVideoSettings(prev => ({
        ...prev,
        ...(type === 'intro' 
          ? { introVideoUrl: data.videoUrl, introImageUrl: params.imageUrl, introPrompt: params.prompt }
          : { outroVideoUrl: data.videoUrl, outroImageUrl: params.imageUrl, outroPrompt: params.prompt }
        ),
      }))
      
      alert(`✅ ${type === 'intro' ? 'Intro' : 'Outro'} générée avec succès !`)
    } catch (error) {
      clearInterval(interval)
      console.error('Generation error:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Generation failed'}`)
    } finally {
      setGenerating(false)
      setGenerationMessage('')
    }
  }

  // Delete video
  const handleDelete = async (type: 'intro' | 'outro') => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${type === 'intro' ? "l'intro" : "l'outro"} ?`)) {
      return
    }

    try {
      const response = await fetch(`/api/settings/video?type=${type}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      setVideoSettings(prev => ({
        ...prev,
        ...(type === 'intro' 
          ? { introVideoUrl: undefined, introImageUrl: undefined, introPrompt: undefined }
          : { outroVideoUrl: undefined, outroImageUrl: undefined, outroPrompt: undefined }
        ),
      }))
      
      // Clear params
      if (type === 'intro') {
        setIntroParams(prev => ({ ...prev, imageUrl: '' }))
      } else {
        setOutroParams(prev => ({ ...prev, imageUrl: '' }))
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Erreur lors de la suppression')
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-secondary)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-accent)' }} />
      </div>
    )
  }

  const currentVideo = activeTab === 'intro' ? videoSettings.introVideoUrl : videoSettings.outroVideoUrl
  const currentParams = activeTab === 'intro' ? introParams : outroParams
  const setCurrentParams = activeTab === 'intro' ? setIntroParams : setOutroParams
  const isGenerating = activeTab === 'intro' ? isGeneratingIntro : isGeneratingOutro
  const imageRef = activeTab === 'intro' ? introImageRef : outroImageRef
  const uploadRef = activeTab === 'intro' ? introUploadRef : outroUploadRef

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-secondary)' }}>
      <Sidebar />
      
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
              Paramètres Vidéo
            </h1>
            <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
              Configurez les vidéos d'introduction et de conclusion pour vos podcasts
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-accent)' }} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Tab Navigation */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === 'intro' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('intro')}
                  className={activeTab === 'intro' ? 'bg-brand-accent' : ''}
                >
                  <Film className="h-4 w-4 mr-2" />
                  Intro
                  {videoSettings.introVideoUrl && (
                    <span className="ml-2 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </Button>
                <Button
                  variant={activeTab === 'outro' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('outro')}
                  className={activeTab === 'outro' ? 'bg-brand-accent' : ''}
                >
                  <Film className="h-4 w-4 mr-2" />
                  Outro
                  {videoSettings.outroVideoUrl && (
                    <span className="ml-2 w-2 h-2 rounded-full bg-green-500" />
                  )}
                </Button>
              </div>

              {/* Current Video Preview */}
              {currentVideo && (
                <Card className="border-green-500 bg-green-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-green-900">
                        ✅ {activeTab === 'intro' ? 'Intro' : 'Outro'} configurée
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activeTab)}
                        className="text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <video 
                      src={currentVideo} 
                      controls 
                      className="w-full max-w-md mx-auto rounded-lg border-2 border-green-200"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Uploader une vidéo
                  </CardTitle>
                  <CardDescription>
                    Uploadez directement une vidéo d'{activeTab === 'intro' ? 'introduction' : 'outro'} (MP4, WebM, MOV - max 50MB)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    type="file"
                    ref={uploadRef}
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleVideoUpload(file, activeTab)
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => uploadRef.current?.click()}
                    className="w-full h-24 border-dashed"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6" />
                      <span>Cliquez pour sélectionner une vidéo</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>

              {/* AI Generation Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Générer avec l'IA (Veo 3.1)
                  </CardTitle>
                  <CardDescription>
                    Générez une vidéo animée à partir d'une image et d'un prompt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Image Upload */}
                  <div>
                    <Label className="mb-2 block">Image source</Label>
                    <div className="flex gap-4 items-start">
                      <input
                        type="file"
                        ref={imageRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, activeTab)
                        }}
                      />
                      
                      {currentParams.imageUrl ? (
                        <div className="relative">
                          <img 
                            src={currentParams.imageUrl} 
                            alt="Source" 
                            className="w-32 h-32 object-cover rounded-lg border"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white hover:bg-red-600"
                            onClick={() => setCurrentParams(prev => ({ ...prev, imageUrl: '' }))}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => imageRef.current?.click()}
                          className="w-32 h-32 border-dashed"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <ImageIcon className="h-6 w-6" />
                            <span className="text-xs">Ajouter</span>
                          </div>
                        </Button>
                      )}
                      
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">
                          Uploadez une image qui servira de base pour l'animation.
                          Idéalement en 720p ou plus, format 9:16 ou 16:9.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prompt */}
                  <div>
                    <Label>Prompt de génération</Label>
                    <Textarea
                      value={currentParams.prompt}
                      onChange={(e) => setCurrentParams(prev => ({ ...prev, prompt: e.target.value }))}
                      placeholder="Décrivez l'animation souhaitée..."
                      className="mt-2 min-h-[100px]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Décrivez les mouvements, transitions et effets souhaités
                    </p>
                  </div>

                  {/* Parameters Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Format</Label>
                      <Select
                        value={currentParams.aspectRatio}
                        onValueChange={(value: '9:16' | '16:9') => 
                          setCurrentParams(prev => ({ ...prev, aspectRatio: value }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                          <SelectItem value="16:9">16:9 (Paysage)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Durée</Label>
                      <Select
                        value={currentParams.duration}
                        onValueChange={(value: '4s' | '6s' | '8s') => 
                          setCurrentParams(prev => ({ ...prev, duration: value }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4s">4 secondes</SelectItem>
                          <SelectItem value="6s">6 secondes</SelectItem>
                          <SelectItem value="8s">8 secondes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Résolution</Label>
                      <Select
                        value={currentParams.resolution}
                        onValueChange={(value: '720p' | '1080p') => 
                          setCurrentParams(prev => ({ ...prev, resolution: value }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="720p">720p</SelectItem>
                          <SelectItem value="1080p">1080p</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Audio</Label>
                      <Select
                        value={currentParams.generateAudio ? 'yes' : 'no'}
                        onValueChange={(value) => 
                          setCurrentParams(prev => ({ ...prev, generateAudio: value === 'yes' }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Avec audio</SelectItem>
                          <SelectItem value="no">Sans audio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Generate Button */}
                  {isGenerating ? (
                    <div 
                      className="p-6 rounded-xl text-center"
                      style={{ backgroundColor: 'var(--brand-accent)', color: 'white' }}
                    >
                      <div className="flex justify-center mb-4">
                        <div className="flex items-end gap-1 h-12">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="w-2 bg-white/80 rounded-full"
                              style={{
                                animation: 'soundWave 1s ease-in-out infinite',
                                animationDelay: `${i * 0.1}s`,
                                height: '40%',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="font-medium mb-1">Génération en cours</p>
                      <p className="text-white/70 text-sm animate-pulse">{generationMessage}</p>
                      <p className="text-white/50 text-xs mt-2">
                        Cela peut prendre 2-3 minutes...
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleGenerate(activeTab)}
                      disabled={!currentParams.imageUrl || !currentParams.prompt.trim()}
                      className="w-full"
                      size="lg"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer l'{activeTab === 'intro' ? 'intro' : 'outro'} avec Veo 3.1
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-6" style={{ borderTop: '1px solid var(--brand-secondary)' }}>
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--brand-text)', opacity: 0.4 }}>
              <span>Video Creator © 2025</span>
              <span>POC Propulsé par l'IA</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

