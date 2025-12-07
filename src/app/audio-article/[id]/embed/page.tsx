'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Play, Pause, Volume2, Loader2 } from 'lucide-react'

interface AudioArticle {
  id: number
  title: string
  summary: string
  audioUrl: string | null
  voice: string
}

type EmbedStyle = 'minimal' | 'card' | 'full'

export default function AudioArticleEmbedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const style = (searchParams.get('style') || 'card') as EmbedStyle
  
  const [article, setArticle] = useState<AudioArticle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/audio-article/${id}`)
        if (response.ok) {
          const data = await response.json()
          setArticle(data.article)
        }
      } catch (err) {
        console.error('Error fetching article:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchArticle()
    }
  }, [id])

  useEffect(() => {
    if (article?.audioUrl && !audioRef.current) {
      const audio = new Audio(article.audioUrl)
      audio.onloadedmetadata = () => setDuration(audio.duration)
      audio.ontimeupdate = () => setProgress((audio.currentTime / audio.duration) * 100)
      audio.onended = () => setIsPlaying(false)
      audioRef.current = audio
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [article?.audioUrl])

  const togglePlayback = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    audioRef.current.currentTime = percentage * audioRef.current.duration
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!article || !article.audioUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-white text-gray-500 text-sm">
        Audio non disponible
      </div>
    )
  }

  // Minimal Style - Just a simple player bar
  if (style === 'minimal') {
    return (
      <div className="h-full bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center gap-4">
        <button
          onClick={togglePlayback}
          className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6 text-white" />
          ) : (
            <Play className="h-6 w-6 text-white ml-0.5" />
          )}
        </button>
        <div className="flex-1">
          <p className="text-white font-medium text-sm truncate">{article.title}</p>
          <div 
            className="h-1.5 bg-white/30 rounded-full mt-1 cursor-pointer"
            onClick={seekTo}
          >
            <div 
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-white/70 text-xs">
          {formatTime(duration)}
        </span>
      </div>
    )
  }

  // Card Style - Compact card with title and player
  if (style === 'card') {
    return (
      <div className="h-full bg-white border rounded-xl shadow-lg overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3">
          <h3 className="text-white font-semibold truncate">{article.title}</h3>
        </div>
        <div className="flex-1 p-4 flex items-center gap-4">
          <button
            onClick={togglePlayback}
            className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors shadow-md flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-0.5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div 
              className="h-2 bg-gray-200 rounded-full cursor-pointer"
              onClick={seekTo}
            >
              <div 
                className="h-full bg-purple-600 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime((progress / 100) * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-400">
          <Volume2 className="h-3 w-3" />
          <span>Audio Article</span>
        </div>
      </div>
    )
  }

  // Full Style - Complete player with summary
  return (
    <div className="h-full bg-white border rounded-xl shadow-lg overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
        <h3 className="text-white font-bold text-lg">{article.title}</h3>
        <p className="text-white/70 text-sm mt-1">Résumé audio</p>
      </div>
      
      <div className="p-6 flex items-center gap-4 border-b">
        <button
          onClick={togglePlayback}
          className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors shadow-lg flex-shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-8 w-8" />
          ) : (
            <Play className="h-8 w-8 ml-1" />
          )}
        </button>
        <div className="flex-1">
          <div 
            className="h-3 bg-gray-200 rounded-full cursor-pointer"
            onClick={seekTo}
          >
            <div 
              className="h-full bg-purple-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>{formatTime((progress / 100) * duration)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <h4 className="font-semibold text-gray-900 mb-2">Résumé</h4>
        <p className="text-gray-600 text-sm leading-relaxed">{article.summary}</p>
      </div>

      <div className="px-6 py-3 bg-gray-50 flex items-center gap-2 text-xs text-gray-400">
        <Volume2 className="h-3 w-3" />
        <span>Audio Article • Généré par IA</span>
      </div>
    </div>
  )
}

