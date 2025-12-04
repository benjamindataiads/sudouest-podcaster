import { NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // 3 minutes for 4 image generations

const NANO_BANANA_MODEL = 'fal-ai/nano-banana-pro/edit'

interface NanoBananaOutput {
  images: Array<{
    url: string
    width?: number
    height?: number
    content_type?: string
  }>
  description?: string
}

const VARIATION_PROMPTS = [
  {
    label: 'variation-1',
    description: 'Plan légèrement plus serré',
    prompt: 'Same person, exact same clothes, exact same background. Slightly tighter crop, closer view. Eyes looking directly at camera. Keep all logos and text unchanged.',
  },
  {
    label: 'variation-2', 
    description: 'Plan légèrement plus large',
    prompt: 'Same person, exact same clothes, exact same background. Slightly wider crop, more space around subject. Eyes looking directly at camera. Keep all logos and text unchanged.',
  },
  {
    label: 'variation-3',
    description: 'Mains légèrement différentes',
    prompt: 'Same person, exact same clothes, exact same background. Slightly different hand position, natural gesture. Eyes looking directly at camera. Keep all logos and text unchanged.',
  },
  {
    label: 'variation-4',
    description: 'Expression légèrement différente',
    prompt: 'Same person, exact same clothes, exact same background. Slightly different facial expression, subtle smile variation. Eyes looking directly at camera. Keep all logos and text unchanged.',
  },
]

/**
 * POST /api/genai/image-variations
 * Generate 4 pose variations from a source image
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceImageUrl, resolution = '1K' } = body

    if (!sourceImageUrl) {
      return NextResponse.json(
        { error: 'sourceImageUrl is required' },
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

    console.log(`🎨 Generating 4 pose variations from: ${sourceImageUrl}`)

    // Generate all 4 variations in parallel
    const variationPromises = VARIATION_PROMPTS.map(async (variation) => {
      console.log(`   Generating ${variation.label}: ${variation.description}`)
      
      const result = await fal.subscribe(NANO_BANANA_MODEL, {
        input: {
          prompt: variation.prompt,
          image_urls: [sourceImageUrl],
          num_images: 1,
          aspect_ratio: 'auto',
          resolution,
          output_format: 'png',
        },
        logs: false,
      }) as NanoBananaOutput

      if (!result.images?.[0]?.url) {
        throw new Error(`Failed to generate ${variation.label}`)
      }

      return {
        url: result.images[0].url,
        label: variation.label,
        description: variation.description,
        width: result.images[0].width,
        height: result.images[0].height,
      }
    })

    const variations = await Promise.all(variationPromises)

    console.log(`✅ Generated ${variations.length} pose variations`)

    // Return original + variations
    const allImages = [
      {
        url: sourceImageUrl,
        label: 'original',
        description: 'Image originale',
      },
      ...variations,
    ]

    return NextResponse.json({
      success: true,
      images: allImages,
      count: allImages.length,
    })

  } catch (error) {
    console.error('Error generating variations:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate variations', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

