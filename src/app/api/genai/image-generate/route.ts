import { NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes for image generation

// Using Recraft v3 for high quality text-to-image
const IMAGE_MODEL = 'fal-ai/recraft-v3'

interface RecraftInput {
  prompt: string
  image_size?: {
    width: number
    height: number
  }
  style?: string
  colors?: Array<{
    r: number
    g: number
    b: number
  }>
}

interface RecraftOutput {
  images: Array<{
    url: string
    width?: number
    height?: number
    content_type?: string
  }>
}

/**
 * POST /api/genai/image-generate
 * Generate images from text prompt using Recraft v3
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      prompt, 
      width = 1280,
      height = 720,
      style = 'realistic_image',
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Configure fal.ai
    const falKey = process.env.FAL_KEY
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured' },
        { status: 500 }
      )
    }

    fal.config({ credentials: falKey })

    console.log(`🎨 Generating image with Recraft v3`)
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`)
    console.log(`   Size: ${width}x${height}`)
    console.log(`   Style: ${style}`)

    const input: RecraftInput = {
      prompt,
      image_size: {
        width,
        height,
      },
      style,
    }

    const result = await fal.subscribe(IMAGE_MODEL, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`   Image generation in progress...`)
        }
      },
    }) as RecraftOutput

    if (!result.images?.[0]?.url) {
      throw new Error('No image generated')
    }

    console.log(`✅ Image generated: ${result.images[0].url}`)

    return NextResponse.json({
      success: true,
      imageUrl: result.images[0].url,
      width: result.images[0].width,
      height: result.images[0].height,
    })

  } catch (error) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate image', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

