'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Loader2 } from 'lucide-react'

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

  const handleCreate = async () => {
    if (!podcastName.trim()) {
      alert('Veuillez saisir un nom pour le podcast')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Nouveau podcast
          </DialogTitle>
          <DialogDescription>
            Donnez un nom à votre podcast et choisissez une date
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              autoFocus
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

          {/* Aperçu */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Aperçu</p>
            <p className="text-sm font-medium text-gray-900">
              {podcastName || 'Nom du podcast'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {new Date(podcastDate).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !podcastName.trim()}
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


