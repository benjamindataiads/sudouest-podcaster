'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PodcastScript } from '@/types'
import { AVAILABLE_VOICES } from '@/lib/services/fal'
import { Loader2, Download, X, Volume2 } from 'lucide-react'

interface AudioChunk {
  url: string
  text: string
  chunkIndex: number
  section?: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
  duration?: number
}

interface StepThreeProps {
  script: PodcastScript | null
  existingAudioChunks?: AudioChunk[]
  podcastId?: number | null
  onComplete: (audioUrl: string, audioChunks?: AudioChunk[]) => void
  onBack: () => void
}

export default function StepThree({ script, existingAudioChunks, podcastId, onBack, onComplete }: StepThreeProps) {
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_VOICES[0].id)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])
  const [progress, setProgress] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Log si on charge des audios existants
  if (existingAudioChunks && existingAudioChunks.length > 0) {
    console.log(`✅ Loading ${existingAudioChunks.length} existing audio chunks from database`)
  }

  if (!script) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erreur</CardTitle>
          <CardDescription>Script manquant</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onBack}>Retour</Button>
        </CardContent>
      </Card>
    )
  }

  const fullScript = `${script.introduction}\n\n${script.articles.map(a => a.content).join('\n\n')}\n\n${script.conclusion}`

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setProgress('')
    setProgressPercent(0)
  }

  const generateAudio = async () => {
    try {
      setLoading(true)
      setProgress('Démarrage de la génération audio...')
      setProgressPercent(5)

      abortControllerRef.current = new AbortController()

      // Utiliser les chunks du script si disponibles, sinon le texte complet
      const requestBody = script?.chunks 
        ? { scriptChunks: script.chunks, voiceId: selectedVoice }
        : { script: fullScript, voiceId: selectedVoice }

      setProgressPercent(10)

      const response = await fetch('/api/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération de l\'audio')
      }

      setProgressPercent(95)
      setProgress('Finalisation...')
      const data = await response.json()
      
      console.log('✅ Audio generated successfully with', data.audioChunks?.length || 1, 'chunks')
      
      // Passer automatiquement à l'étape suivante
      const audioUrl = data.audioUrl || (data.audioChunks && data.audioChunks.length > 0 ? data.audioChunks[0].url : '')
      const chunks = data.audioChunks || []
      
      onComplete(audioUrl, chunks.length > 0 ? chunks : undefined)
      
    } catch (err) {
      console.error(err)
      setLoading(false)
      alert('Erreur lors du démarrage de la génération')
    }
  }

  const mergeAudioChunks = async () => {
    try {
      setLoading(true)
      setProgress('Fusion des segments audio...')
      setProgressPercent(10)

      // Importer la fonction de merge
      const { mergeAudioChunks: mergeChunks } = await import('@/lib/services/fal')
      
      setProgressPercent(50)
      const merged = await mergeChunks(audioChunks, 15) // Max 15 secondes
      
      setProgressPercent(100)
      setAudioChunks(merged)
      setProgress('Segments fusionnés avec succès !')
      
      setTimeout(() => {
        setLoading(false)
        setProgress('')
      }, 1000)
    } catch (err) {
      console.error('Erreur lors de la fusion:', err)
      alert('Erreur lors de la fusion des segments')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Génération en cours</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelGeneration}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">{progress}</p>
              <p className="text-sm text-gray-500 mb-4">
                Cela peut prendre plusieurs minutes...
              </p>
            </div>
            
            {/* Barre de progression */}
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-center text-gray-500">
                {progressPercent}% complété
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (audioUrl || audioChunks.length > 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>✅ Audio généré avec succès !</CardTitle>
            <CardDescription>
              {audioChunks.length > 0 
                ? `${audioChunks.length} segments audio générés`
                : 'Votre fichier audio est prêt'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Un seul fichier audio */}
            {audioUrl && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center">
                  <Volume2 className="mr-2 h-5 w-5" />
                  Audio MP3
                </h3>
                <audio controls src={audioUrl} className="w-full mb-3" />
                <Button asChild className="w-full">
                  <a href={audioUrl} download="podcast-sudouest.mp3">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger l&apos;audio (MP3)
                  </a>
                </Button>
              </div>
            )}

            {/* Plusieurs chunks audio */}
            {audioChunks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">
                    {audioChunks.length} segment{audioChunks.length > 1 ? 's' : ''} audio
                  </p>
                  {audioChunks.length > 1 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={mergeAudioChunks}
                      disabled={loading}
                    >
                      Fusionner en segments de 15s max
                    </Button>
                  )}
                </div>
                {audioChunks.map((chunk, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold mb-2 text-sm flex items-center justify-between">
                      <span className="flex items-center">
                        <Volume2 className="mr-2 h-4 w-4" />
                        Segment {chunk.chunkIndex + 1}/{audioChunks.length}
                      </span>
                      <a 
                        href={chunk.url} 
                        download={`podcast-segment-${chunk.chunkIndex + 1}.mp3`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Télécharger
                      </a>
                    </h3>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{chunk.text}</p>
                    <audio controls src={chunk.url} className="w-full" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Retour
          </Button>
          <div className="space-x-3">
            <Button variant="outline" onClick={() => {
              setAudioUrl('')
              setAudioChunks([])
              setSelectedVoice(AVAILABLE_VOICES[0].id)
            }}>
              Regénérer
            </Button>
            <Button 
              onClick={() => onComplete(
                audioUrl || audioChunks[0]?.url,
                audioChunks.length > 0 ? audioChunks : undefined
              )} 
              size="lg"
            >
              Continuer vers la vidéo
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sélection de la voix */}
      <Card>
        <CardHeader>
          <CardTitle>Choix de la voix</CardTitle>
          <CardDescription>
            Sélectionnez une voix pour la narration audio du podcast
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_VOICES.map(voice => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className={`
                  p-4 border rounded-lg text-left transition-all
                  ${selectedVoice === voice.id 
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' 
                    : 'border-gray-300 hover:border-gray-400'
                  }
                `}
              >
                <div className="font-semibold">{voice.name}</div>
                <div className="text-sm text-gray-600">
                  {voice.gender === 'male' ? '♂️' : '♀️'} {voice.language}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aperçu du script */}
      <Card>
        <CardHeader>
          <CardTitle>Aperçu du script</CardTitle>
          <CardDescription>
            Le texte qui sera converti en audio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {fullScript.substring(0, 500)}...
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Longueur totale : {fullScript.length} caractères
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={generateAudio} size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération...
            </>
          ) : (
            <>
              <Volume2 className="mr-2 h-4 w-4" />
              Générer l&apos;audio
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

