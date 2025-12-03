'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Loader2, User, Check } from 'lucide-react'

interface Avatar {
  id: number
  name: string
  voiceUrl: string
  imageUrl: string
  isDefault: boolean
}

interface CreatePodcastDialogProps {
  children: React.ReactNode
}

export default function CreatePodcastDialog({ children }: CreatePodcastDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [podcastName, setPodcastName] = useState('')
  const [podcastDate, setPodcastDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null)
  const [loadingAvatars, setLoadingAvatars] = useState(false)

  // Load avatars when dialog opens
  useEffect(() => {
    if (open) {
      loadAvatars()
    }
  }, [open])

  const loadAvatars = async () => {
    setLoadingAvatars(true)
    try {
      const response = await fetch('/api/avatars')
      const data = await response.json()
      setAvatars(data.avatars || [])
      // Select default avatar
      const defaultAvatar = data.avatars?.find((a: Avatar) => a.isDefault)
      if (defaultAvatar) {
        setSelectedAvatarId(defaultAvatar.id)
      } else if (data.avatars?.length > 0) {
        setSelectedAvatarId(data.avatars[0].id)
      }
    } catch (error) {
      console.error('Error loading avatars:', error)
    } finally {
      setLoadingAvatars(false)
    }
  }

  const handleCreate = async () => {
    if (!podcastName.trim()) {
      alert('Veuillez saisir un nom pour le podcast')
      return
    }

    if (!selectedAvatarId) {
      alert('Veuillez sélectionner un avatar')
      return
    }

    try {
      setLoading(true)

      // Créer le podcast dans la DB
      const response = await fetch('/api/podcasts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: podcastName,
          date: new Date(podcastDate),
          status: 'draft',
          currentStep: 1,
          avatarId: selectedAvatarId,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la création du podcast')
      }

      const data = await response.json()
      const podcastId = data.podcast.id

      // Rediriger vers la page de création avec l'ID
      router.push(`/create?resume=${podcastId}`)
    } catch (error) {
      console.error('Error creating podcast:', error)
      alert('Erreur lors de la création du podcast')
      setLoading(false)
    }
  }

  const selectedAvatar = avatars.find(a => a.id === selectedAvatarId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Nouveau podcast
          </DialogTitle>
          <DialogDescription>
            Choisissez un avatar, donnez un nom et sélectionnez une date
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Choisir un avatar *
            </Label>
            
            {loadingAvatars ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatarId(avatar.id)}
                    disabled={loading}
                    className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                      selectedAvatarId === avatar.id
                        ? 'border-[#D42E1B] bg-red-50 ring-2 ring-[#D42E1B]/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {selectedAvatarId === avatar.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-[#D42E1B] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gray-100">
                      <img
                        src={avatar.imageUrl}
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{avatar.name}</p>
                    {avatar.isDefault && (
                      <span className="text-xs text-[#D42E1B]">Par défaut</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nom du podcast */}
            <div className="space-y-2">
              <Label htmlFor="podcast-name" className="text-sm font-medium">
                Nom du podcast *
              </Label>
              <Input
                id="podcast-name"
                placeholder="Ex: Actualités du jour"
                value={podcastName}
                onChange={(e) => setPodcastName(e.target.value)}
                className="w-full"
                disabled={loading}
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="podcast-date" className="text-sm font-medium">
                Date
              </Label>
              <div className="relative">
                <Input
                  id="podcast-date"
                  type="date"
                  value={podcastDate}
                  onChange={(e) => setPodcastDate(e.target.value)}
                  className="w-full"
                  disabled={loading}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Aperçu */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Aperçu</p>
            <div className="flex items-center gap-4">
              {selectedAvatar && (
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                  <img
                    src={selectedAvatar.imageUrl}
                    alt={selectedAvatar.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {podcastName || 'Nom du podcast'}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedAvatar ? `Présenté par ${selectedAvatar.name}` : 'Sélectionnez un avatar'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(podcastDate).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !podcastName.trim() || !selectedAvatarId}
            className="bg-[#D42E1B] hover:bg-[#B01030]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              'Créer le podcast'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


