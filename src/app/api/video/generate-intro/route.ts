import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as fal from '@fal-ai/serverless-client'
import { db, organizationSettings, type OrganizationVideoSettings } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for video generation

const VEO_MODEL = 'fal-ai/veo3.1/fast/image-to-video'

interface VeoInput {
  prompt: string
  image_url: string
  aspect_ratio: '9:16' | '16:9' | 'auto'
  duration: '4s' | '6s' | '8s'
  generate_audio: boolean
  resolution: '720p' | '1080p'
}

interface VeoOutput {
  video: {
    url: string
    file_name?: string
    content_type?: string
    file_size?: number
  }
}

/**
 * POST /api/video/generate-intro
 * Generate intro or outro video using Veo 3.1 image-to-video
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      imageUrl,
      prompt,
      type = 'intro', // 'intro' or 'outro'
      aspectRatio = '9:16',
      duration = '4s',
      generateAudio = true,
      resolution = '720p',
    } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    const falKey = process.env.FAL_KEY
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured' },
        { status: 500 }
      )
    }

    fal.config({ credentials: falKey })

    console.log(`🎬 Generating ${type} video with Veo 3.1`)
    console.log(`   Image: ${imageUrl}`)
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`)
    console.log(`   Aspect: ${aspectRatio}, Duration: ${duration}, Audio: ${generateAudio}`)

    const input: VeoInput = {
      prompt,
      image_url: imageUrl,
      aspect_ratio: aspectRatio,
      duration,
      generate_audio: generateAudio,
      resolution,
    }

    // Generate video with Veo 3.1
    const result = await fal.subscribe(VEO_MODEL, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`   Veo 3.1 generation in progress...`)
        }
      },
    }) as VeoOutput

    if (!result.video?.url) {
      throw new Error('No video URL in Veo result')
    }

    console.log(`✅ ${type} video generated: ${result.video.url}`)

    // Save to organization settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSettingsResult = await (db as any)
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)
    
    const existingSettings = existingSettingsResult[0]

    const currentVideoSettings = existingSettings?.videoSettings || {}
    
    const updatedVideoSettings = {
      ...currentVideoSettings,
      ...(type === 'intro' ? {
        introVideoUrl: result.video.url,
        introImageUrl: imageUrl,
        introPrompt: prompt,
      } : {
        outroVideoUrl: result.video.url,
        outroImageUrl: imageUrl,
        outroPrompt: prompt,
      }),
    }

    if (existingSettings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(organizationSettings)
        .set({
          videoSettings: updatedVideoSettings,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.orgId, orgId))
    }

    return NextResponse.json({
      success: true,
      videoUrl: result.video.url,
      type,
    })

  } catch (error) {
    console.error('Error generating intro/outro:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate video', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

