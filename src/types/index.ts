/**
 * Types communs pour l'application
 */

export interface ScrapedArticle {
  title: string
  summary: string
  content: string
  url: string
  imageUrl?: string
  category?: string
  publishedAt: Date
}

export interface ArticleWithScore extends ScrapedArticle {
  id: number
  score: number // score d'intérêt généré par l'IA
  selected: boolean
}

export interface ScriptChunk {
  text: string
  index: number
  section: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

export interface PodcastScript {
  introduction: string
  articles: {
    articleId: number
    title: string
    content: string // contenu du script pour cet article
  }[]
  conclusion: string
  estimatedDuration: number // en secondes
  chunks?: ScriptChunk[] // Chunks de 300 caractères max pour TTS (Minimax Voice Clone)
}

export interface VoiceOption {
  id: string
  name: string
  language: string
  gender: 'male' | 'female'
  previewUrl?: string
}

export interface AvatarOption {
  id: string
  name: string
  thumbnailUrl: string
  gender: 'male' | 'female'
}

export interface GenerationProgress {
  step: 'scraping' | 'analyzing' | 'script_generation' | 'audio_generation' | 'video_generation' | 'completed'
  progress: number // 0-100
  message: string
}

export type PodcastStatus = 'draft' | 'script_ready' | 'audio_generated' | 'video_generated' | 'completed'

