/**
 * Fal.ai Proxy Route
 * 
 * This proxy keeps the FAL_KEY secure on the server side.
 * All fal.ai requests from the client should go through this proxy.
 * 
 * Based on: https://docs.fal.ai/model-apis/model-endpoints/server-side
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Allowed fal.ai domains
const ALLOWED_DOMAINS = ['fal.ai', 'fal.run', 'queue.fal.run']

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

async function handleProxy(request: NextRequest) {
  // Get target URL from header
  const targetUrl = request.headers.get('x-fal-target-url')
  
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing x-fal-target-url header' },
      { status: 400 }
    )
  }
  
  // Validate target URL
  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json(
      { error: 'Invalid target URL - must be a fal.ai domain' },
      { status: 412 }
    )
  }
  
  // Get FAL_KEY
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return NextResponse.json(
      { error: 'FAL_KEY not configured' },
      { status: 500 }
    )
  }
  
  try {
    // Forward headers (excluding host and some others)
    const forwardHeaders = new Headers()
    forwardHeaders.set('Authorization', `Key ${falKey}`)
    forwardHeaders.set('Content-Type', 'application/json')
    
    // Copy relevant headers from original request
    const acceptHeader = request.headers.get('accept')
    if (acceptHeader) {
      forwardHeaders.set('Accept', acceptHeader)
    }
    
    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
    }
    
    // Add body for POST/PUT requests
    if (request.method === 'POST' || request.method === 'PUT') {
      const contentType = request.headers.get('content-type')
      if (contentType && !contentType.includes('application/json')) {
        return NextResponse.json(
          { error: 'Content-Type must be application/json' },
          { status: 415 }
        )
      }
      fetchOptions.body = await request.text()
    }
    
    console.log(`🔀 Proxy: ${request.method} ${targetUrl}`)
    
    // Make the request to fal.ai
    const response = await fetch(targetUrl, fetchOptions)
    
    // Get response body
    const responseBody = await response.text()
    
    // Return response with same status and relevant headers
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'application/json')
    
    // Copy some headers from fal.ai response
    const requestId = response.headers.get('x-fal-request-id')
    if (requestId) {
      responseHeaders.set('x-fal-request-id', requestId)
    }
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    })
    
  } catch (error) {
    console.error('❌ Proxy error:', error)
    return NextResponse.json(
      { error: 'Proxy request failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleProxy(request)
}

export async function POST(request: NextRequest) {
  return handleProxy(request)
}

export async function PUT(request: NextRequest) {
  return handleProxy(request)
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-fal-target-url',
    },
  })
}

