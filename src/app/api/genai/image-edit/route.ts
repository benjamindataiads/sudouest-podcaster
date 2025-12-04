import { NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes for image generation

const NANO_BANANA_MODEL = 'fal-ai/nano-banana-pro/edit'

interface NanoBananaInput {
  prompt: string
  image_urls: string[]
  num_images?: number
  aspect_ratio?: string
  resolution?: '1K' | '2K' | '4K'
  output_format?: 'jpeg' | 'png' | 'webp'
  enable_web_search?: boolean
}

interface NanoBananaOutput {
  images: Array<{
    url: string
    width?: number
    height?: number
    content_type?: string
  }>
  description?: string
}

/**
 * POST /api/genai/image-edit
 * Generate/edit images using nano-banana-pro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      prompt, 
      imageUrls, 
      numImages = 1,
      aspectRatio = 'auto',
      resolution = '1K',
      outputFormat = 'png',
      enableWebSearch = false
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one image URL is required' },
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

    console.log(`🎨 Starting image edit with nano-banana-pro`)
    console.log(`   Prompt: ${prompt}`)
    console.log(`   Images: ${imageUrls.length}`)
    console.log(`   Resolution: ${resolution}`)

    const input: NanoBananaInput = {
      prompt,
      image_urls: imageUrls,
      num_images: Math.min(numImages, 4), // Max 4
      aspect_ratio: aspectRatio,
      resolution,
      output_format: outputFormat,
      enable_web_search: enableWebSearch,
    }

    // Use subscribe for real-time updates
    const result = await fal.subscribe(NANO_BANANA_MODEL, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`   Status: ${update.status}`)
        }
      },
    }) as NanoBananaOutput

    console.log(`✅ Image generation complete: ${result.images.length} images`)

    return NextResponse.json({
      success: true,
      images: result.images,
      description: result.description,
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

