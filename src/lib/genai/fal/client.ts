/**
 * Fal.ai Client Configuration
 * 
 * This module provides the fal.ai client setup and helper functions.
 * All fal.ai requests should go through the proxy for security.
 */

// ============================================
// Environment & Configuration
// ============================================

export function getFalKey(): string {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error('FAL_KEY environment variable is not set')
  }
  return key
}

export function getWebhookUrl(): string {
  let baseUrl: string
  
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else {
    baseUrl = 'http://localhost:3001'
  }
  
  return `${baseUrl}/api/webhooks/fal`
}

// ============================================
// Fal.ai API Helpers
// ============================================

const FAL_QUEUE_BASE = 'https://queue.fal.run'

interface FalSubmitOptions {
  model: string
  input: Record<string, unknown>
  useWebhook?: boolean
}

interface FalSubmitResponse {
  request_id: string
}

/**
 * Submit a job to fal.ai queue with optional webhook
 */
export async function submitToFal({
  model,
  input,
  useWebhook = true,
}: FalSubmitOptions): Promise<FalSubmitResponse> {
  const falKey = getFalKey()
  const webhookUrl = useWebhook ? getWebhookUrl() : null
  
  const url = webhookUrl
    ? `${FAL_QUEUE_BASE}/${model}?fal_webhook=${encodeURIComponent(webhookUrl)}`
    : `${FAL_QUEUE_BASE}/${model}`
  
  console.log(`📤 Submitting to fal.ai: ${model}`)
  console.log(`   Webhook: ${webhookUrl || 'disabled'}`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Fal.ai submission failed: ${response.status}`, errorText)
    throw new Error(`Fal.ai error ${response.status}: ${errorText}`)
  }
  
  const data = await response.json()
  console.log(`✅ Submitted to fal.ai: ${data.request_id}`)
  
  return data
}

/**
 * Get status of a fal.ai job
 */
export async function getFalStatus(model: string, requestId: string): Promise<{
  status: string
  logs?: string[]
}> {
  const falKey = getFalKey()
  
  const response = await fetch(`${FAL_QUEUE_BASE}/${model}/status/${requestId}`, {
    headers: {
      'Authorization': `Key ${falKey}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Get result of a completed fal.ai job
 */
export async function getFalResult<T>(model: string, requestId: string): Promise<T> {
  const falKey = getFalKey()
  
  const response = await fetch(`${FAL_QUEUE_BASE}/${model}/result/${requestId}`, {
    headers: {
      'Authorization': `Key ${falKey}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get result: ${response.status}`)
  }
  
  return response.json()
}

