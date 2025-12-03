'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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

  // Load avatars
  useEffect(() => {
    loadAvatars()
  }, [])

  const loadAvatars = async () => {
    try {
      const response = await fetch('/api/avatars')
      const data = await response.json()
      setAvatars(data.avatars || [])
    } catch (err) {
      setError('Failed to load avatars')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (avatar: Avatar) => {
    if (avatar.isDefault) {
      alert('Cannot delete the default avatar')
      return
    }
    
    if (!confirm(`Are you sure you want to delete "${avatar.name}"?`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/avatars/${avatar.id}`, { method: 'DELETE' })
      if (response.ok) {
        loadAvatars()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete avatar')
      }
    } catch (err) {
      alert('Failed to delete avatar')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← Retour
            </Link>
            <h1 className="text-2xl font-bold text-white">Avatars</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvel Avatar
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </main>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAvatar) && (
        <AvatarModal
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
      )}
    </div>
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

  const playVoice = () => {
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
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/50 transition-all group">
      {/* Avatar Image */}
      <div className="relative aspect-square bg-slate-700/30">
        <img
          src={avatar.imageUrl}
          alt={avatar.name}
          className="w-full h-full object-cover"
        />
        {avatar.isDefault && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
            Par défaut
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-3">{avatar.name}</h3>

        {/* Voice Preview */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={playVoice}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            <span>{isPlaying ? 'Stop' : 'Écouter la voix'}</span>
          </button>
          <audio
            ref={audioRef}
            src={avatar.voiceUrl}
            onEnded={() => setIsPlaying(false)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            Modifier
          </button>
          {!avatar.isDefault && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AvatarModal({
  avatar,
  onClose,
  onSave,
}: {
  avatar: Avatar | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(avatar?.name || '')
  const [voiceUrl, setVoiceUrl] = useState(avatar?.voiceUrl || '')
  const [imageUrl, setImageUrl] = useState(avatar?.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!avatar

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
        throw new Error(data.error || 'Upload failed')
      }
      
      if (type === 'voice') {
        setVoiceUrl(data.url)
      } else {
        setImageUrl(data.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !voiceUrl || !imageUrl) {
      setError('Please fill in all fields')
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
        body: JSON.stringify({ name, voiceUrl, imageUrl }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save avatar')
      }
      
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save avatar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? 'Modifier l\'avatar' : 'Nouvel avatar'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nom de l'avatar
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marie Dupont"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Voice Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Voix de référence (MP3)
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={voiceUrl}
                onChange={(e) => setVoiceUrl(e.target.value)}
                placeholder="URL du fichier MP3..."
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
              <label className="px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white cursor-pointer transition-colors whitespace-nowrap">
                {uploading ? '...' : 'Upload'}
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
              <audio src={voiceUrl} controls className="mt-2 w-full h-10" />
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Image de l'avatar (PNG, JPG)
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL de l'image..."
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
              <label className="px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white cursor-pointer transition-colors whitespace-nowrap">
                {uploading ? '...' : 'Upload'}
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
              <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-slate-600">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

