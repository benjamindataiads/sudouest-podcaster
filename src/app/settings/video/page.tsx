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

// Step 1: Image transformation params (nano-banana-pro)
interface ImageTransformParams {
  sourceImageUrl: string      // Image source à transformer
  prompt: string              // Prompt de transformation
  resolution: '1K' | '2K' | '4K'
  aspectRatio: string
  outputFormat: 'png' | 'jpeg' | 'webp'
}

// Step 2: Video generation params (Veo 3.1)
interface VideoGenParams {
  imageUrl: string            // Image transformée pour la vidéo
  prompt: string              // Prompt d'animation
  aspectRatio: '9:16' | '16:9'
  duration: '4s' | '6s' | '8s'
  generateAudio: boolean
  resolution: '720p' | '1080p'
}

// Resolution options for nano-banana-pro
const IMAGE_RESOLUTIONS = [
  { value: '1K', label: '1K (1024px)' },
  { value: '2K', label: '2K (2048px)' },
  { value: '4K', label: '4K (4096px)' },
]

// Aspect ratio options
const ASPECT_RATIOS = [
  { value: 'auto', label: 'Auto (garder original)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '16:9', label: '16:9 (Paysage)' },
  { value: '1:1', label: '1:1 (Carré)' },
]

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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [generationMessage, setGenerationMessage] = useState('')
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  
  // Upload refs
  const introUploadRef = useRef<HTMLInputElement>(null)
  const outroUploadRef = useRef<HTMLInputElement>(null)
  const introImageRef = useRef<HTMLInputElement>(null)
  const outroImageRef = useRef<HTMLInputElement>(null)
  
  // Step 1: Image transformation params (nano-banana-pro)
  const [introImageParams, setIntroImageParams] = useState<ImageTransformParams>({
    sourceImageUrl: '',
    prompt: 'Style cinématique professionnel, ajout d\'effets lumineux subtils, ambiance moderne et élégante pour intro de podcast vidéo',
    resolution: '2K',
    aspectRatio: '9:16',
    outputFormat: 'png',
  })
  
  const [outroImageParams, setOutroImageParams] = useState<ImageTransformParams>({
    sourceImageUrl: '',
    prompt: 'Style cinématique professionnel, ajout d\'effets de fondu élégant, ambiance de conclusion pour outro de podcast',
    resolution: '2K',
    aspectRatio: '9:16',
    outputFormat: 'png',
  })
  
  // Step 2: Video generation params  
  const [introVideoParams, setIntroVideoParams] = useState<VideoGenParams>({
    imageUrl: '',
    prompt: DEFAULT_INTRO_PROMPT,
    aspectRatio: '9:16',
    duration: '4s',
    generateAudio: true,
    resolution: '720p',
  })
  
  const [outroVideoParams, setOutroVideoParams] = useState<VideoGenParams>({
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
          
          // Pre-fill video params if available
          if (data.videoSettings?.introImageUrl) {
            setIntroVideoParams(prev => ({
              ...prev,
              imageUrl: data.videoSettings.introImageUrl,
              prompt: data.videoSettings.introPrompt || DEFAULT_INTRO_PROMPT,
            }))
          }
          if (data.videoSettings?.outroImageUrl) {
            setOutroVideoParams(prev => ({
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
        setIntroVideoParams(prev => ({ ...prev, imageUrl: data.url }))
      } else {
        setOutroVideoParams(prev => ({ ...prev, imageUrl: data.url }))
      }
      setCurrentStep(2) // Move to step 2
    } catch (error) {
      console.error('Image upload error:', error)
      alert(`Erreur lors de l'upload de l'image: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    }
  }

  // Handle source image upload for nano-banana-pro
  const handleSourceImageUpload = async (file: File, type: 'intro' | 'outro') => {
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
        setIntroImageParams(prev => ({ ...prev, sourceImageUrl: data.url }))
      } else {
        setOutroImageParams(prev => ({ ...prev, sourceImageUrl: data.url }))
      }
    } catch (error) {
      console.error('Source image upload error:', error)
      alert(`Erreur lors de l'upload: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    }
  }

  // Step 1: Transform image with nano-banana-pro
  const handleTransformImage = async (type: 'intro' | 'outro') => {
    const params = type === 'intro' ? introImageParams : outroImageParams
    
    if (!params.sourceImageUrl) {
      alert('Veuillez d\'abord uploader une image source')
      return
    }

    if (!params.prompt.trim()) {
      alert('Veuillez entrer un prompt de transformation')
      return
    }

    setIsGeneratingImage(true)
    setGenerationMessage('Transformation de l\'image...')

    const messages = [
      'Analyse de l\'image source...',
      'Application du style avec Nano-Banana Pro...',
      'Transformation en cours...',
      'Finalisation...',
    ]
    let msgIndex = 0
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length
      setGenerationMessage(messages[msgIndex])
    }, 3000)

    try {
      const response = await fetch('/api/genai/image-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          imageUrls: [params.sourceImageUrl],
          numImages: 1,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          outputFormat: params.outputFormat,
        }),
      })

      clearInterval(interval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Image transformation failed')
      }

      const data = await response.json()
      
      if (!data.images?.[0]?.url) {
        throw new Error('No image returned')
      }
      
      // Set the transformed image URL for step 2
      if (type === 'intro') {
        setIntroVideoParams(prev => ({ ...prev, imageUrl: data.images[0].url }))
      } else {
        setOutroVideoParams(prev => ({ ...prev, imageUrl: data.images[0].url }))
      }
      
      setCurrentStep(2) // Move to step 2
      alert('✅ Image transformée ! Passez à l\'étape 2 pour créer la vidéo.')
    } catch (error) {
      clearInterval(interval)
      console.error('Image transformation error:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Transformation failed'}`)
    } finally {
      setIsGeneratingImage(false)
      setGenerationMessage('')
    }
  }

  // Step 2: Generate video with Veo 3.1
  const handleGenerateVideo = async (type: 'intro' | 'outro') => {
    const params = type === 'intro' ? introVideoParams : outroVideoParams
    
    if (!params.imageUrl) {
      alert('Veuillez d\'abord générer ou uploader une image (étape 1)')
      return
    }

    if (!params.prompt.trim()) {
      alert('Veuillez entrer un prompt pour la vidéo')
      return
    }

    setIsGeneratingVideo(true)
    setGenerationMessage('Préparation de la génération vidéo...')

    const messages = [
      'Préparation de la génération vidéo...',
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
      
      setCurrentStep(1) // Reset to step 1
      alert(`✅ ${type === 'intro' ? 'Intro' : 'Outro'} générée avec succès !`)
    } catch (error) {
      clearInterval(interval)
      console.error('Generation error:', error)
      alert(`Erreur: ${error instanceof Error ? error.message : 'Generation failed'}`)
    } finally {
      setIsGeneratingVideo(false)
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
        setIntroVideoParams(prev => ({ ...prev, imageUrl: '' }))
      } else {
        setOutroVideoParams(prev => ({ ...prev, imageUrl: '' }))
      }
      setCurrentStep(1)
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
  const currentImageParams = activeTab === 'intro' ? introImageParams : outroImageParams
  const setCurrentImageParams = activeTab === 'intro' ? setIntroImageParams : setOutroImageParams
  const currentVideoParams = activeTab === 'intro' ? introVideoParams : outroVideoParams
  const setCurrentVideoParams = activeTab === 'intro' ? setIntroVideoParams : setOutroVideoParams
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

              {/* AI Generation - 2 Step Workflow */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Générer avec l'IA (2 étapes)
                  </CardTitle>
                  <CardDescription>
                    1️⃣ Créez une image avec Recraft v3 → 2️⃣ Animez-la avec Veo 3.1
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Step Indicator */}
                  <div className="flex items-center gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-secondary)' }}>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        currentStep === 1 ? 'bg-white shadow font-medium' : 'opacity-60 hover:opacity-80'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center">1</span>
                      <span>Générer l'image</span>
                    </button>
                    <ChevronRight className="h-5 w-5 opacity-40" />
                    <button
                      onClick={() => currentVideoParams.imageUrl && setCurrentStep(2)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        currentStep === 2 ? 'bg-white shadow font-medium' : 'opacity-60 hover:opacity-80'
                      } ${!currentVideoParams.imageUrl ? 'cursor-not-allowed' : ''}`}
                    >
                      <span className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center ${
                        currentVideoParams.imageUrl ? 'bg-purple-600' : 'bg-gray-400'
                      }`}>2</span>
                      <span>Créer la vidéo</span>
                    </button>
                  </div>

                  {/* STEP 1: Image Transformation with Nano-Banana Pro */}
                  {currentStep === 1 && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h3 className="font-semibold flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Étape 1 : Transformer une image (Nano-Banana Pro)
                      </h3>
                      <p className="text-sm text-gray-500">
                        Uploadez votre logo ou image, puis appliquez un style cinématique pour l'intro/outro
                      </p>

                      {/* Source Image Upload */}
                      <div className="p-4 border-2 border-dashed rounded-lg">
                        <Label className="mb-2 block font-medium">Image source</Label>
                        <div className="flex gap-4 items-center">
                          <input
                            type="file"
                            ref={imageRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleSourceImageUpload(file, activeTab)
                            }}
                          />
                          
                          {currentImageParams.sourceImageUrl ? (
                            <div className="relative">
                              <img 
                                src={currentImageParams.sourceImageUrl} 
                                alt="Source" 
                                className="w-24 h-24 object-cover rounded-lg border"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white hover:bg-red-600"
                                onClick={() => setCurrentImageParams(prev => ({ ...prev, sourceImageUrl: '' }))}
                              >
                                ×
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => imageRef.current?.click()}
                              className="w-24 h-24 border-dashed"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <Upload className="h-6 w-6" />
                                <span className="text-xs">Upload</span>
                              </div>
                            </Button>
                          )}
                          
                          <div className="flex-1 text-sm text-gray-500">
                            <p>Uploadez votre logo, une image de fond, ou une photo.</p>
                            <p className="text-xs mt-1">Formats: JPG, PNG, WebP (max 10MB)</p>
                          </div>
                        </div>
                      </div>

                      {/* Transformation Prompt */}
                      <div>
                        <Label>Prompt de transformation</Label>
                        <Textarea
                          value={currentImageParams.prompt}
                          onChange={(e) => setCurrentImageParams(prev => ({ ...prev, prompt: e.target.value }))}
                          placeholder="Décrivez le style à appliquer..."
                          className="mt-2 min-h-[80px]"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Ex: "Style cinématique, ajout d'effets lumineux, ambiance professionnelle"
                        </p>
                      </div>

                      {/* Transformation Parameters */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Résolution</Label>
                          <Select
                            value={currentImageParams.resolution}
                            onValueChange={(value: '1K' | '2K' | '4K') => 
                              setCurrentImageParams(prev => ({ ...prev, resolution: value }))
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {IMAGE_RESOLUTIONS.map(res => (
                                <SelectItem key={res.value} value={res.value}>
                                  {res.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Format</Label>
                          <Select
                            value={currentImageParams.aspectRatio}
                            onValueChange={(value) => setCurrentImageParams(prev => ({ ...prev, aspectRatio: value }))}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASPECT_RATIOS.map(ratio => (
                                <SelectItem key={ratio.value} value={ratio.value}>
                                  {ratio.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Sortie</Label>
                          <Select
                            value={currentImageParams.outputFormat}
                            onValueChange={(value: 'png' | 'jpeg' | 'webp') => 
                              setCurrentImageParams(prev => ({ ...prev, outputFormat: value }))
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="png">PNG</SelectItem>
                              <SelectItem value="jpeg">JPEG</SelectItem>
                              <SelectItem value="webp">WebP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Transform Image Button */}
                      {isGeneratingImage ? (
                        <div className="p-4 rounded-lg text-center bg-purple-600 text-white">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          <p className="font-medium">Transformation en cours...</p>
                          <p className="text-white/70 text-sm animate-pulse">{generationMessage}</p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleTransformImage(activeTab)}
                            disabled={!currentImageParams.sourceImageUrl || !currentImageParams.prompt.trim()}
                            className="flex-1"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Transformer avec Nano-Banana Pro
                          </Button>
                          <span className="flex items-center text-gray-400 px-2">ou</span>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (currentImageParams.sourceImageUrl) {
                                // Use source image directly without transformation
                                if (activeTab === 'intro') {
                                  setIntroVideoParams(prev => ({ ...prev, imageUrl: currentImageParams.sourceImageUrl }))
                                } else {
                                  setOutroVideoParams(prev => ({ ...prev, imageUrl: currentImageParams.sourceImageUrl }))
                                }
                                setCurrentStep(2)
                              } else {
                                alert('Veuillez d\'abord uploader une image')
                              }
                            }}
                            disabled={!currentImageParams.sourceImageUrl}
                          >
                            Utiliser sans transformation
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}

                      {/* Preview of transformed image */}
                      {currentVideoParams.imageUrl && (
                        <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                          <div className="flex items-start gap-4">
                            <div className="flex gap-2">
                              {currentImageParams.sourceImageUrl && (
                                <div className="text-center">
                                  <img 
                                    src={currentImageParams.sourceImageUrl} 
                                    alt="Original" 
                                    className="w-20 h-20 object-cover rounded-lg border opacity-60"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Original</p>
                                </div>
                              )}
                              <ChevronRight className="h-5 w-5 text-gray-400 self-center" />
                              <div className="text-center">
                                <img 
                                  src={currentVideoParams.imageUrl} 
                                  alt="Transformée" 
                                  className="w-20 h-20 object-cover rounded-lg border-2 border-green-400"
                                />
                                <p className="text-xs text-green-600 mt-1">Transformée</p>
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-green-800">✅ Image prête pour animation</p>
                              <p className="text-sm text-green-600">Passez à l'étape 2 pour créer la vidéo</p>
                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() => setCurrentStep(2)}
                              >
                                Continuer vers étape 2
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentVideoParams(prev => ({ ...prev, imageUrl: '' }))}
                              className="text-red-500 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: Video Generation */}
                  {currentStep === 2 && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Film className="h-5 w-5" />
                        Étape 2 : Animer l'image avec Veo 3.1
                      </h3>

                      {/* Source Image Preview */}
                      {currentVideoParams.imageUrl && (
                        <div className="flex items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--brand-secondary)' }}>
                          <img 
                            src={currentVideoParams.imageUrl} 
                            alt="Source" 
                            className="w-20 h-20 object-cover rounded-lg border"
                          />
                          <div>
                            <p className="font-medium">Image source</p>
                            <button 
                              onClick={() => setCurrentStep(1)}
                              className="text-sm text-purple-600 hover:underline"
                            >
                              Changer l'image
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Video Prompt */}
                      <div>
                        <Label>Prompt pour l'animation (Veo 3.1)</Label>
                        <Textarea
                          value={currentVideoParams.prompt}
                          onChange={(e) => setCurrentVideoParams(prev => ({ ...prev, prompt: e.target.value }))}
                          placeholder="Décrivez l'animation souhaitée..."
                          className="mt-2 min-h-[80px]"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Décrivez les mouvements de caméra, transitions et effets
                        </p>
                      </div>

                      {/* Video Parameters Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Format</Label>
                          <Select
                            value={currentVideoParams.aspectRatio}
                            onValueChange={(value: '9:16' | '16:9') => 
                              setCurrentVideoParams(prev => ({ ...prev, aspectRatio: value }))
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
                            value={currentVideoParams.duration}
                            onValueChange={(value: '4s' | '6s' | '8s') => 
                              setCurrentVideoParams(prev => ({ ...prev, duration: value }))
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
                            value={currentVideoParams.resolution}
                            onValueChange={(value: '720p' | '1080p') => 
                              setCurrentVideoParams(prev => ({ ...prev, resolution: value }))
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
                            value={currentVideoParams.generateAudio ? 'yes' : 'no'}
                            onValueChange={(value) => 
                              setCurrentVideoParams(prev => ({ ...prev, generateAudio: value === 'yes' }))
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

                      {/* Generate Video Button */}
                      {isGeneratingVideo ? (
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
                          <p className="font-medium mb-1">Génération vidéo en cours</p>
                          <p className="text-white/70 text-sm animate-pulse">{generationMessage}</p>
                          <p className="text-white/50 text-xs mt-2">
                            Cela peut prendre 2-3 minutes...
                          </p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleGenerateVideo(activeTab)}
                          disabled={!currentVideoParams.imageUrl || !currentVideoParams.prompt.trim()}
                          className="w-full"
                          size="lg"
                        >
                          <Film className="h-4 w-4 mr-2" />
                          Générer la vidéo avec Veo 3.1
                        </Button>
                      )}
                    </div>
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

