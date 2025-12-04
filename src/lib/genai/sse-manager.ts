/**
 * SSE (Server-Sent Events) Connection Manager
 * 
 * Manages active SSE connections and broadcasts events to them.
 * Used to push real-time updates when fal.ai webhooks are received.
 * 
 * Note: This uses in-memory storage. For multi-instance deployments,
 * consider using Redis pub/sub instead.
 */

import type { SSEEvent, JobType } from './types'

// ============================================
// Types
// ============================================

interface SSEConnection {
  id: string
  podcastId?: number
  controller: ReadableStreamDefaultController
  createdAt: Date
}

// ============================================
// Connection Store
// ============================================

// Map of connection ID -> connection info
const connections = new Map<string, SSEConnection>()

// Map of podcast ID -> Set of connection IDs (for quick lookup)
const podcastConnections = new Map<number, Set<string>>()

// ============================================
// Connection Management
// ============================================

/**
 * Register a new SSE connection
 */
export function registerConnection(
  connectionId: string,
  controller: ReadableStreamDefaultController,
  podcastId?: number
): void {
  const connection: SSEConnection = {
    id: connectionId,
    podcastId,
    controller,
    createdAt: new Date(),
  }
  
  connections.set(connectionId, connection)
  
  if (podcastId) {
    if (!podcastConnections.has(podcastId)) {
      podcastConnections.set(podcastId, new Set())
    }
    podcastConnections.get(podcastId)!.add(connectionId)
  }
  
  console.log(`📡 SSE connection registered: ${connectionId} (podcast: ${podcastId || 'none'})`)
  console.log(`   Total connections: ${connections.size}`)
}

/**
 * Unregister an SSE connection
 */
export function unregisterConnection(connectionId: string): void {
  const connection = connections.get(connectionId)
  
  if (connection) {
    if (connection.podcastId) {
      const podcastSet = podcastConnections.get(connection.podcastId)
      if (podcastSet) {
        podcastSet.delete(connectionId)
        if (podcastSet.size === 0) {
          podcastConnections.delete(connection.podcastId)
        }
      }
    }
    
    connections.delete(connectionId)
    console.log(`📡 SSE connection unregistered: ${connectionId}`)
  }
}

// ============================================
// Event Broadcasting
// ============================================

/**
 * Format an SSE event for transmission
 */
function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Send an event to a specific connection
 */
function sendToConnection(connectionId: string, event: SSEEvent): boolean {
  const connection = connections.get(connectionId)
  
  if (!connection) {
    return false
  }
  
  try {
    const encoder = new TextEncoder()
    connection.controller.enqueue(encoder.encode(formatSSEEvent(event)))
    return true
  } catch (error) {
    console.error(`Failed to send to connection ${connectionId}:`, error)
    // Connection is likely closed, clean it up
    unregisterConnection(connectionId)
    return false
  }
}

/**
 * Broadcast an event to all connections for a specific podcast
 */
export function broadcastToPodcast(podcastId: number, event: SSEEvent): number {
  const connectionIds = podcastConnections.get(podcastId)
  
  if (!connectionIds || connectionIds.size === 0) {
    console.log(`📡 No SSE connections for podcast ${podcastId}`)
    return 0
  }
  
  let sent = 0
  for (const connectionId of connectionIds) {
    if (sendToConnection(connectionId, event)) {
      sent++
    }
  }
  
  console.log(`📡 Broadcast to ${sent}/${connectionIds.size} connections for podcast ${podcastId}`)
  return sent
}

/**
 * Broadcast an event to all connections
 */
export function broadcastToAll(event: SSEEvent): number {
  let sent = 0
  for (const connectionId of connections.keys()) {
    if (sendToConnection(connectionId, event)) {
      sent++
    }
  }
  return sent
}

// ============================================
// Event Helpers
// ============================================

/**
 * Create and broadcast a job created event
 */
export function notifyJobCreated(
  podcastId: number,
  jobId: string,
  jobType: JobType
): void {
  const event: SSEEvent = {
    type: 'job_created',
    jobId,
    jobType,
    timestamp: new Date().toISOString(),
  }
  broadcastToPodcast(podcastId, event)
}

/**
 * Create and broadcast a job completed event
 */
export function notifyJobCompleted(
  podcastId: number,
  jobId: string,
  jobType: JobType,
  data: Record<string, unknown>
): void {
  const event: SSEEvent = {
    type: 'job_completed',
    jobId,
    jobType,
    data,
    timestamp: new Date().toISOString(),
  }
  broadcastToPodcast(podcastId, event)
}

/**
 * Create and broadcast a job failed event
 */
export function notifyJobFailed(
  podcastId: number,
  jobId: string,
  jobType: JobType,
  error: string
): void {
  const event: SSEEvent = {
    type: 'job_failed',
    jobId,
    jobType,
    error,
    timestamp: new Date().toISOString(),
  }
  broadcastToPodcast(podcastId, event)
}

// ============================================
// Utilities
// ============================================

/**
 * Get stats about current connections
 */
export function getConnectionStats(): {
  totalConnections: number
  connectionsByPodcast: Record<number, number>
} {
  const connectionsByPodcast: Record<number, number> = {}
  
  for (const [podcastId, connectionIds] of podcastConnections) {
    connectionsByPodcast[podcastId] = connectionIds.size
  }
  
  return {
    totalConnections: connections.size,
    connectionsByPodcast,
  }
}

/**
 * Generate a unique connection ID
 */
export function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

