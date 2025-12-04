/**
 * Types for GenAI services (fal.ai, OpenAI, etc.)
 */

// ============================================
// Job Types
// ============================================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type JobType = 'audio' | 'video' | 'transcription'

export interface GenAIJob {
  id: string
  type: JobType
  status: JobStatus
  podcastId?: number
  falRequestId?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

// ============================================
// Audio Generation Types
// ============================================

export interface AudioGenerationInput {
  text: string
  voiceUrl: string // URL of reference voice for cloning
  chunkIndex?: number
  section?: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

export interface AudioGenerationOutput {
  audioUrl: string
  duration?: number
}

export interface AudioChunk {
  url: string
  text: string
  chunkIndex: number
  duration?: number
  section?: 'introduction' | 'article' | 'conclusion'
  articleTitle?: string
}

// ============================================
// Video Generation Types
// ============================================

export interface VideoGenerationInput {
  audioUrl: string
  imageUrl: string // Avatar image URL
}

export interface VideoGenerationOutput {
  videoUrl: string
  duration?: number
}

// ============================================
// Transcription Types
// ============================================

export interface TranscriptionInput {
  audioUrl: string
  language?: string
}

export interface TranscriptionChunk {
  text: string
  timestamp: [number, number] // [start, end] in seconds
}

export interface TranscriptionOutput {
  text: string
  chunks: TranscriptionChunk[]
  srt?: string
}

// ============================================
// SSE Event Types
// ============================================

export type SSEEventType = 
  | 'connected'
  | 'job_created'
  | 'job_processing'
  | 'job_completed'
  | 'job_failed'
  | 'ping'

export interface SSEEvent {
  type: SSEEventType
  jobId?: string
  jobType?: JobType
  data?: Record<string, unknown>
  error?: string
  timestamp: string
}

// ============================================
// Fal.ai Specific Types
// ============================================

export interface FalQueueResponse {
  request_id: string
  status?: string
}

export interface FalWebhookPayload {
  request_id: string
  status: 'OK' | 'ERROR'
  payload?: {
    audio?: { url: string }
    video?: { url: string }
    chunks?: TranscriptionChunk[]
  }
  error?: string
  payload_error?: string
}

