'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  Download, 
  Loader2,
  Share2,
  Code,
  Check,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface AudioArticle {
  id: number
  title: string
  summary: string
  audioUrl: string | null
  voice: string
  createdAt: string
}

export default function AudioArticleViewPage() {
  const params = useParams()
  const id = params.id as string
  const { isSignedIn } = useAuth()
  
  const [article, setArticle] = useState<AudioArticle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedStyle, setEmbedStyle] = useState<'minimal' | 'card' | 'full'>('card')

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/audio-article/${id}`)
        if (!response.ok) {
          throw new Error('Article non trouvé')
        }
        const data = await response.json()
        setArticle(data.article)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchArticle()
    }
  }, [id])

  const togglePlayback = () => {
    if (!article?.audioUrl) return

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

  const copyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getEmbedCode = () => {
    const baseUrl = window.location.origin
    return `<iframe src="${baseUrl}/audio-article/${id}/embed?style=${embedStyle}" width="${embedStyle === 'minimal' ? '400' : '100%'}" height="${embedStyle === 'minimal' ? '80' : embedStyle === 'card' ? '200' : '400'}" frameborder="0" allow="autoplay"></iframe>`
  }

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-500 mb-4">{error || 'Article non trouvé'}</p>
            {isSignedIn && (
              <Link href="/audio-article">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Link - only show for authenticated users */}
        {isSignedIn && (
          <Link href="/audio-article" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux articles
          </Link>
        )}

        {/* Main Card */}
        <Card className="overflow-hidden shadow-xl">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white">
            <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
            <p className="text-white/70 text-sm">
              {new Date(article.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>

          <CardContent className="p-6">
            {/* Audio Player */}
            {article.audioUrl && (
              <div className="bg-gray-100 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayback}
                    className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors shadow-lg"
                  >
                    {isPlaying ? (
                      <Pause className="h-8 w-8" />
                    ) : (
                      <Play className="h-8 w-8 ml-1" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Écouter le résumé</p>
                    <p className="text-sm text-gray-500">Audio généré par IA</p>
                  </div>
                  <a
                    href={article.audioUrl}
                    download={`${article.title}.mp3`}
                    className="p-3 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <Download className="h-5 w-5 text-gray-600" />
                  </a>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="mb-6">
              <h2 className="font-semibold text-gray-900 mb-2">Résumé</h2>
              <p className="text-gray-700 leading-relaxed">{article.summary}</p>
            </div>

            {/* Share Options */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Partager</h3>
              
              <div className="flex gap-3 mb-4">
                <Button onClick={copyLink} variant="outline" className="flex-1">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Copier le lien
                    </>
                  )}
                </Button>
                <Button onClick={() => setShowEmbed(!showEmbed)} variant="outline" className="flex-1">
                  <Code className="h-4 w-4 mr-2" />
                  Code embed
                </Button>
              </div>

              {/* Embed Options */}
              {showEmbed && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Style du player</p>
                    <div className="flex gap-2">
                      {(['minimal', 'card', 'full'] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => setEmbedStyle(style)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            embedStyle === style
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border hover:bg-gray-100'
                          }`}
                        >
                          {style === 'minimal' && 'Minimal'}
                          {style === 'card' && 'Carte'}
                          {style === 'full' && 'Complet'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Aperçu</p>
                    <div className={`bg-white rounded-lg border overflow-hidden ${
                      embedStyle === 'minimal' ? 'h-20' : 
                      embedStyle === 'card' ? 'h-48' : 'h-96'
                    }`}>
                      <iframe
                        src={`/audio-article/${id}/embed?style=${embedStyle}`}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        allow="autoplay"
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Code à copier</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      {getEmbedCode()}
                    </div>
                  </div>

                  <Button onClick={copyEmbedCode} className="w-full">
                    {copied ? 'Copié !' : 'Copier le code embed'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

