/**
 * SSE Stream Endpoint for Real-time GenAI Updates
 * 
 * GET /api/genai/stream?podcastId=123
 * 
 * Clients connect here to receive real-time updates when:
 * - Audio/video generation jobs are created
 * - Jobs complete (via fal.ai webhook)
 * - Jobs fail
 */

import { NextRequest } from 'next/server'
import {
  registerConnection,
  unregisterConnection,
  generateConnectionId,
} from '@/lib/genai/sse-manager'
import type { SSEEvent } from '@/lib/genai/types'

export const dynamic = 'force-dynamic'

// Keep connection alive with periodic pings
const PING_INTERVAL_MS = 30000 // 30 seconds

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const podcastIdParam = searchParams.get('podcastId')
  const podcastId = podcastIdParam ? parseInt(podcastIdParam) : undefined
  
  if (podcastIdParam && isNaN(podcastId!)) {
    return new Response(JSON.stringify({ error: 'Invalid podcastId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  const connectionId = generateConnectionId()
  let pingInterval: NodeJS.Timeout | null = null
  
  const stream = new ReadableStream({
    start(controller) {
      // Register the connection
      registerConnection(connectionId, controller, podcastId)
      
      // Send initial connected event
      const connectedEvent: SSEEvent = {
        type: 'connected',
        data: { connectionId, podcastId },
        timestamp: new Date().toISOString(),
      }
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectedEvent)}\n\n`))
      
      // Set up ping to keep connection alive
      pingInterval = setInterval(() => {
        try {
          const pingEvent: SSEEvent = {
            type: 'ping',
            timestamp: new Date().toISOString(),
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(pingEvent)}\n\n`))
        } catch {
          // Connection closed, clean up
          if (pingInterval) {
            clearInterval(pingInterval)
          }
        }
      }, PING_INTERVAL_MS)
    },
    
    cancel() {
      // Clean up when connection closes
      console.log(`📡 SSE connection closing: ${connectionId}`)
      if (pingInterval) {
        clearInterval(pingInterval)
      }
      unregisterConnection(connectionId)
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

