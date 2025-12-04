/**
 * React Hook for GenAI SSE Stream
 * 
 * Connects to /api/genai/stream and provides real-time updates
 * for audio/video generation jobs.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { SSEEvent, AudioChunk } from '@/lib/genai/types'

interface UseGenAIStreamOptions {
  podcastId: number | null
  onAudioChunkComplete?: (chunkIndex: number, chunkUrl: string, totalChunks: number) => void
  onAllAudioComplete?: (audioChunks: AudioChunk[]) => void
  onVideoComplete?: (videoUrl: string) => void
  onError?: (jobType: string, error: string) => void
}

interface StreamState {
  connected: boolean
  connectionId: string | null
}

export function useGenAIStream({
  podcastId,
  onAudioChunkComplete,
  onAllAudioComplete,
  onVideoComplete,
  onError,
}: UseGenAIStreamOptions) {
  const [state, setState] = useState<StreamState>({
    connected: false,
    connectionId: null,
  })
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const connect = useCallback(() => {
    if (!podcastId) return
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    console.log(`📡 Connecting to SSE stream for podcast ${podcastId}...`)
    
    const url = `/api/genai/stream?podcastId=${podcastId}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource
    
    eventSource.onopen = () => {
      console.log('📡 SSE connection opened')
    }
    
    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data)
        console.log('📥 SSE event received:', data.type, data)
        
        switch (data.type) {
          case 'connected':
            setState({
              connected: true,
              connectionId: data.data?.connectionId as string || null,
            })
            break
            
          case 'job_completed':
            if (data.jobType === 'audio') {
              const audioData = data.data as {
                allComplete?: boolean
                audioChunks?: AudioChunk[]
                chunkIndex?: number
                chunkUrl?: string
                completedChunks?: number
                totalChunks?: number
              }
              
              if (audioData.allComplete && audioData.audioChunks) {
                console.log('🎉 All audio complete!')
                onAllAudioComplete?.(audioData.audioChunks)
              } else if (audioData.chunkIndex !== undefined && audioData.chunkUrl) {
                console.log(`✅ Audio chunk ${audioData.chunkIndex} complete`)
                onAudioChunkComplete?.(
                  audioData.chunkIndex,
                  audioData.chunkUrl,
                  audioData.totalChunks || 0
                )
              }
            } else if (data.jobType === 'video') {
              const videoData = data.data as { videoUrl?: string }
              if (videoData.videoUrl) {
                console.log('🎬 Video complete!')
                onVideoComplete?.(videoData.videoUrl)
              }
            }
            break
            
          case 'job_failed':
            console.error('❌ Job failed:', data.error)
            onError?.(data.jobType || 'unknown', data.error || 'Unknown error')
            break
            
          case 'ping':
            // Keep-alive, ignore
            break
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err)
      }
    }
    
    eventSource.onerror = (err) => {
      console.error('📡 SSE connection error:', err)
      setState(prev => ({ ...prev, connected: false }))
      
      // Attempt to reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('📡 Attempting to reconnect SSE...')
        connect()
      }, 5000)
    }
  }, [podcastId, onAudioChunkComplete, onAllAudioComplete, onVideoComplete, onError])
  
  // Connect when podcastId changes
  useEffect(() => {
    if (podcastId) {
      connect()
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [podcastId, connect])
  
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState({ connected: false, connectionId: null })
  }, [])
  
  return {
    connected: state.connected,
    connectionId: state.connectionId,
    disconnect,
    reconnect: connect,
  }
}

