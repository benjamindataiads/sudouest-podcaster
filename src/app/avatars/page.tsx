'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SudOuestLogo from '@/components/ui/SudOuestLogo'
import { Plus, Film, Loader2, Play, Pause, Trash2, Edit2, User, Home } from 'lucide-react'

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

  const isEditing = !!avatar

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName(avatar?.name || '')
      setVoiceUrl(avatar?.voiceUrl || '')
      setImageUrl(avatar?.imageUrl || '')
      setError(null)
    }
  }, [open, avatar])

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
      <DialogContent className="sm:max-w-lg">
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

          {/* Voice URL */}
          <div className="space-y-2">
            <Label>Voix de référence (MP3) *</Label>
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
              <audio src={voiceUrl} controls className="w-full h-10 mt-2" />
            )}
            <p className="text-xs text-gray-500">
              Astuce: Utilisez une URL publique comme https://dataiads-test1.fr/sudouest/voix.mp3
            </p>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label>Image de l'avatar (PNG, JPG) *</Label>
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
              <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={imageUrl} 
                  alt="Aperçu" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
            <p className="text-xs text-gray-500">
              Astuce: Utilisez une URL publique comme https://dataiads-test1.fr/sudouest/avatarsudsouest.png
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
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
                isEditing ? 'Enregistrer' : 'Créer'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
