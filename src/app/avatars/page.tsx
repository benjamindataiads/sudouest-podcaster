'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import { Plus, Film, Loader2, Play, Pause, Trash2, Edit2, User, Home, Wand2, Upload, Sparkles, ImageIcon, Mic, Square, Volume2, Camera, Video } from 'lucide-react'

interface Avatar {
  id: number
  name: string
  voiceUrl: string
  imageUrl: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvatars()
  }, [])

  const loadAvatars = async () => {
    try {
      const response = await fetch('/api/avatars')
      const data = await response.json()
      setAvatars(data.avatars || [])
    } catch (err) {
      setError('Impossible de charger les avatars')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (avatar: Avatar) => {
    if (avatar.isDefault) {
      alert('Impossible de supprimer l\'avatar par défaut')
      return
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${avatar.name}" ?`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/avatars/${avatar.id}`, { method: 'DELETE' })
      if (response.ok) {
        loadAvatars()
      } else {
        const data = await response.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
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
              <h1 className="text-2xl md:text-3xl font-bold">Avatars</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
                  <Home className="h-4 w-4 mr-2" />
                  Accueil
                </Button>
              </Link>
              <Link href="/gallery">
                <Button variant="outline" className="bg-white text-[#D42E1B] hover:bg-gray-100 border-0">
                  <Film className="h-4 w-4 mr-2" />
                  Galerie
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Title and Add Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Gérer les avatars</h2>
            <p className="text-gray-600 mt-2">
              Créez et gérez les personnages pour vos podcasts
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-[#D42E1B] hover:bg-[#B01030] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel Avatar
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-[#D42E1B]" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600">{error}</p>
            <Button onClick={loadAvatars} className="mt-4">
              Réessayer
            </Button>
          </div>
        ) : avatars.length === 0 ? (
          <div className="text-center py-20">
            <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun avatar</h3>
            <p className="text-gray-600 mb-6">Créez votre premier avatar pour commencer</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-[#D42E1B] hover:bg-[#B01030]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un avatar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {avatars.map((avatar) => (
              <AvatarCard
                key={avatar.id}
                avatar={avatar}
                onEdit={() => setEditingAvatar(avatar)}
                onDelete={() => handleDelete(avatar)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AvatarModal
        open={showCreateModal || !!editingAvatar}
        avatar={editingAvatar}
        onClose={() => {
          setShowCreateModal(false)
          setEditingAvatar(null)
        }}
        onSave={() => {
          loadAvatars()
          setShowCreateModal(false)
          setEditingAvatar(null)
        }}
      />
    </main>
  )
}

function AvatarCard({
  avatar,
  onEdit,
  onDelete,
}: {
  avatar: Avatar
  onEdit: () => void
  onDelete: () => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Avatar Image */}
      <div className="relative aspect-square bg-gray-100">
        <img
          src={avatar.imageUrl}
          alt={avatar.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Avatar'
          }}
        />
        {avatar.isDefault && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-[#D42E1B] text-white text-xs font-medium rounded">
            Par défaut
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{avatar.name}</h3>

        {/* Voice Preview */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePlay}
            className="w-full"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Écouter la voix
              </>
            )}
          </Button>
          <audio
            ref={audioRef}
            src={avatar.voiceUrl}
            onEnded={() => setIsPlaying(false)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          {!avatar.isDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AvatarModal({
  open,
  avatar,
  onClose,
  onSave,
}: {
  open: boolean
  avatar: Avatar | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState('')
  const [voiceUrl, setVoiceUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'ai'>('upload')
  const [voiceTab, setVoiceTab] = useState<'upload' | 'record'>('upload')
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // AI Maker state
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiSourceImages, setAiSourceImages] = useState<string[]>([])
  const [aiResolution, setAiResolution] = useState<'1K' | '2K' | '4K'>('1K')
  const [aiAspectRatio, setAiAspectRatio] = useState<string>('1:1')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGeneratedImages, setAiGeneratedImages] = useState<Array<{ url: string; width?: number; height?: number }>>([])
  
  // Webcam state
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamReady, setWebcamReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const isEditing = !!avatar
  
  // Sample text for voice recording
  const sampleText = `Bonjour et bienvenue dans ce podcast Sud Ouest. Je suis ravi de vous retrouver aujourd'hui pour vous présenter les actualités de notre belle région. 
  
De Bordeaux à Biarritz, en passant par Pau et Arcachon, nous allons explorer ensemble les événements qui font vibrer le Sud-Ouest de la France.`

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName(avatar?.name || '')
      setVoiceUrl(avatar?.voiceUrl || '')
      setImageUrl(avatar?.imageUrl || '')
      setError(null)
      setAiPrompt('')
      setAiSourceImages([])
      setAiGeneratedImages([])
      setRecordedBlob(null)
      setRecordedUrl(null)
      setRecordingTime(0)
      setIsRecording(false)
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl)
      }
    }
  }, [open, avatar])

  // Check microphone permission
  const checkMicPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
      result.onchange = () => {
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
      }
    } catch {
      // Fallback for browsers that don't support permissions API
      setMicPermission('prompt')
    }
  }

  useEffect(() => {
    checkMicPermission()
  }, [])

  // Start recording
  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(audioBlob)
        const url = URL.createObjectURL(audioBlob)
        setRecordedUrl(url)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setMicPermission('denied')
        setError('Accès au microphone refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.')
      } else {
        setError('Impossible d\'accéder au microphone: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  // Upload recorded audio
  const uploadRecording = async () => {
    if (!recordedBlob) return
    
    setUploading(true)
    setError(null)
    
    try {
      // Convert webm to mp3-like format for upload
      const formData = new FormData()
      formData.append('file', recordedBlob, `voice-${Date.now()}.webm`)
      formData.append('type', 'voice')
      
      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'upload')
      }
      
      setVoiceUrl(data.url)
      setVoiceTab('upload') // Switch back to show the result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'upload de l\'enregistrement')
    } finally {
      setUploading(false)
    }
  }

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Start webcam
  const startWebcam = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setWebcamReady(true)
        }
      }
      setShowWebcam(true)
    } catch (err) {
      setError('Impossible d\'accéder à la webcam: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // Stop webcam
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowWebcam(false)
    setWebcamReady(false)
  }

  // Capture photo from webcam
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !webcamReady) return
    
    setUploading(true)
    setError(null)
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Cannot get canvas context')
      
      // Flip horizontally for mirror effect
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/jpeg',
          0.9
        )
      })
      
      // Upload to R2
      const formData = new FormData()
      formData.append('file', blob, `webcam-${Date.now()}.jpg`)
      formData.append('type', 'image')
      
      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'upload')
      }
      
      // Add to AI source images
      setAiSourceImages(prev => [...prev, data.url])
      stopWebcam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la capture')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (file: File, type: 'voice' | 'image') => {
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      
      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'upload')
      }
      
      if (type === 'voice') {
        setVoiceUrl(data.url)
      } else {
        setImageUrl(data.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  // Upload image for AI source
  const handleAiSourceUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')
      
      const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'upload')
      }
      
      setAiSourceImages(prev => [...prev, data.url])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  // Generate with AI
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiSourceImages.length === 0) {
      setError('Veuillez ajouter au moins une image source et un prompt')
      return
    }

    setAiGenerating(true)
    setError(null)
    setAiGeneratedImages([])

    try {
      const response = await fetch('/api/genai/image-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          imageUrls: aiSourceImages,
          numImages: 4,
          aspectRatio: aiAspectRatio,
          resolution: aiResolution,
          outputFormat: 'png',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la génération')
      }

      setAiGeneratedImages(data.images || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la génération')
    } finally {
      setAiGenerating(false)
    }
  }

  // Select AI generated image
  const selectAiImage = (url: string) => {
    setImageUrl(url)
    setActiveTab('upload') // Switch back to upload tab to show the selected image
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !voiceUrl || !imageUrl) {
      setError('Veuillez remplir tous les champs')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const url = isEditing ? `/api/avatars/${avatar.id}` : '/api/avatars'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), voiceUrl: voiceUrl.trim(), imageUrl: imageUrl.trim() }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }
      
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Modifier l\'avatar' : 'Nouvel avatar'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="avatar-name">Nom de l'avatar *</Label>
            <Input
              id="avatar-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marie Dupont"
              disabled={saving}
            />
          </div>

          {/* Voice Section with Tabs */}
          <div className="space-y-2">
            <Label>Voix de référence *</Label>
            
            <Tabs value={voiceTab} onValueChange={(v) => setVoiceTab(v as 'upload' | 'record')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload fichier
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Enregistrer
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-3 mt-4">
                <div className="flex gap-2">
                  <Input
                    value={voiceUrl}
                    onChange={(e) => setVoiceUrl(e.target.value)}
                    placeholder="URL du fichier MP3 ou uploadez..."
                    className="flex-1"
                    disabled={saving}
                  />
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" disabled={uploading || saving} asChild>
                      <span>{uploading ? '...' : 'Upload'}</span>
                    </Button>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'voice')
                      }}
                    />
                  </label>
                </div>
                {voiceUrl && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <Volume2 className="h-5 w-5 text-green-600" />
                    <audio src={voiceUrl} controls className="flex-1 h-10" />
                  </div>
                )}
              </TabsContent>

              {/* Record Tab */}
              <TabsContent value="record" className="space-y-4 mt-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Mic className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Enregistrement vocal</h4>
                  </div>
                  
                  {/* Sample text to read */}
                  <div className="mb-4">
                    <Label className="text-blue-900 mb-2 block">Texte à lire :</Label>
                    <div className="p-3 bg-white rounded-lg border border-blue-200 text-sm text-gray-700 leading-relaxed">
                      {sampleText}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      💡 Lisez ce texte naturellement pour créer un échantillon de voix de qualité
                    </p>
                  </div>

                  {/* Mic permission warning */}
                  {micPermission === 'denied' && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      ⚠️ Accès au microphone refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.
                    </div>
                  )}

                  {/* Recording controls */}
                  <div className="flex items-center gap-4">
                    {!isRecording ? (
                      <Button
                        type="button"
                        onClick={startRecording}
                        disabled={uploading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        Commencer l'enregistrement
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={stopRecording}
                        variant="destructive"
                        className="animate-pulse"
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Arrêter ({formatTime(recordingTime)})
                      </Button>
                    )}
                    
                    {isRecording && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-red-600">Enregistrement en cours...</span>
                      </div>
                    )}
                  </div>

                  {/* Recorded audio preview */}
                  {recordedUrl && !isRecording && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
                        <Play className="h-5 w-5 text-blue-600" />
                        <audio src={recordedUrl} controls className="flex-1 h-10" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={uploadRecording}
                          disabled={uploading}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Upload en cours...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Utiliser cet enregistrement
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setRecordedBlob(null)
                            if (recordedUrl) URL.revokeObjectURL(recordedUrl)
                            setRecordedUrl(null)
                            setRecordingTime(0)
                          }}
                          disabled={uploading}
                        >
                          Recommencer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Show uploaded voice if available */}
                {voiceUrl && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-green-600 font-medium">✓ Voix enregistrée</span>
                    <audio src={voiceUrl} controls className="flex-1 h-10" />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Image Section with Tabs */}
          <div className="space-y-2">
            <Label>Image de l'avatar *</Label>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'ai')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload direct
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  AI Maker
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="URL de l'image ou uploadez..."
                    className="flex-1"
                    disabled={saving}
                  />
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" disabled={uploading || saving} asChild>
                      <span>{uploading ? '...' : 'Upload'}</span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'image')
                      }}
                    />
                  </label>
                </div>
                {imageUrl && (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-[#D42E1B]">
                      <img 
                        src={imageUrl} 
                        alt="Aperçu" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96?text=Error'
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-green-600">✓ Image sélectionnée</p>
                      <p className="text-xs truncate max-w-[200px]">{imageUrl}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* AI Maker Tab */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Avatar AI Maker</h4>
                  </div>
                  <p className="text-sm text-purple-700 mb-4">
                    Uploadez une ou plusieurs photos de référence et décrivez l'avatar que vous souhaitez créer.
                  </p>

                  {/* Source Images */}
                  <div className="space-y-2 mb-4">
                    <Label className="text-purple-900">Images sources *</Label>
                    <div className="flex flex-wrap gap-2">
                      {aiSourceImages.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-purple-300">
                          <img src={url} alt={`Source ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setAiSourceImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {/* Upload button */}
                      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-purple-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors">
                        <Upload className="h-5 w-5 text-purple-400" />
                        <span className="text-[10px] text-purple-400">Fichier</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleAiSourceUpload(file)
                          }}
                        />
                      </label>
                      {/* Webcam button */}
                      <button
                        type="button"
                        onClick={startWebcam}
                        disabled={uploading || showWebcam}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-purple-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-5 w-5 text-purple-400" />
                        <span className="text-[10px] text-purple-400">Webcam</span>
                      </button>
                    </div>
                    <p className="text-xs text-purple-600">
                      Ajoutez des photos (fichier ou webcam) de la personne pour créer un avatar ressemblant
                    </p>
                  </div>

                  {/* Webcam capture */}
                  {showWebcam && (
                    <div className="mb-4 p-4 bg-white rounded-lg border border-purple-300">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Video className="h-5 w-5 text-purple-600" />
                          <span className="font-medium text-purple-900">Capture webcam</span>
                        </div>
                        <button
                          type="button"
                          onClick={stopWebcam}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {!webcamReady && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={capturePhoto}
                        disabled={!webcamReady || uploading}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Upload en cours...
                          </>
                        ) : (
                          <>
                            <Camera className="mr-2 h-4 w-4" />
                            Prendre la photo
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Prompt */}
                  <div className="space-y-2 mb-4">
                    <Label className="text-purple-900">Description / Prompt *</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: portrait professionnel d'un présentateur TV en costume, fond neutre, éclairage studio..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Aspect Ratio & Resolution */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-2">
                      <Label className="text-purple-900">Format</Label>
                      <Select value={aiAspectRatio} onValueChange={setAiAspectRatio}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1:1">1:1 (Carré)</SelectItem>
                          <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                          <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                          <SelectItem value="16:9">16:9 (Paysage)</SelectItem>
                          <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-purple-900">Résolution</Label>
                      <Select value={aiResolution} onValueChange={(v) => setAiResolution(v as '1K' | '2K' | '4K')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1K">1K (rapide)</SelectItem>
                          <SelectItem value="2K">2K (standard)</SelectItem>
                          <SelectItem value="4K">4K (haute qualité)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || aiSourceImages.length === 0 || !aiPrompt.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Génération en cours... (30-60s)
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Générer 4 variantes
                      </>
                    )}
                  </Button>
                </div>

                {/* Generated Images */}
                {aiGeneratedImages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Résultats - Cliquez pour sélectionner</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {aiGeneratedImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectAiImage(img.url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                            imageUrl === img.url ? 'border-[#D42E1B] ring-2 ring-[#D42E1B]' : 'border-gray-200 hover:border-purple-400'
                          }`}
                        >
                          <img src={img.url} alt={`Généré ${idx + 1}`} className="w-full h-full object-cover" />
                          {imageUrl === img.url && (
                            <div className="absolute inset-0 bg-[#D42E1B]/20 flex items-center justify-center">
                              <span className="bg-[#D42E1B] text-white px-2 py-1 rounded text-xs font-medium">
                                ✓ Sélectionné
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving || uploading || !name.trim() || !voiceUrl || !imageUrl}
              className="flex-1 bg-[#D42E1B] hover:bg-[#B01030]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                isEditing ? 'Enregistrer' : 'Créer l\'avatar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
