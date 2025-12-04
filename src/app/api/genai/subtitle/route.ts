import { NextRequest, NextResponse } from 'next/server'
import * as fal from '@fal-ai/serverless-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for subtitle generation

const AUTO_SUBTITLE_MODEL = 'fal-ai/workflow-utilities/auto-subtitle'

// Available options for the UI
export const FONT_COLORS = ['white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'cyan', 'magenta'] as const
export const POSITIONS = ['top', 'center', 'bottom'] as const
export const FONT_WEIGHTS = ['normal', 'bold', 'black'] as const

interface SubtitleInput {
  video_url: string
  language: string
  font_name: string
  font_size: number
  font_weight: string
  font_color: string
  highlight_color: string
  stroke_width: number
  stroke_color: string
  position: string
  y_offset: number
  words_per_subtitle: number
  enable_animation: boolean
  background_color: string
  background_opacity: number
}

interface SubtitleOutput {
  video: {
    url: string
    file_name?: string
    content_type?: string
    file_size?: number
  }
  transcription: string
  subtitle_count: number
}

/**
 * POST /api/genai/subtitle
 * Generate subtitles for a video using fal.ai auto-subtitle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      videoUrl,
      fontName = 'Montserrat',
      fontSize = 80,
      fontWeight = 'bold',
      fontColor = 'white',
      highlightColor = 'yellow',
      strokeWidth = 3,
      strokeColor = 'black',
      position = 'bottom',
      yOffset = 75,
      wordsPerSubtitle = 3,
      enableAnimation = true,
    } = body

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl is required' },
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

    console.log(`📝 Generating subtitles for video: ${videoUrl}`)
    console.log(`   Font: ${fontName} ${fontSize}px ${fontWeight}`)
    console.log(`   Colors: text=${fontColor}, highlight=${highlightColor}, stroke=${strokeColor}`)
    console.log(`   Position: ${position}, Y offset: ${yOffset}`)
    console.log(`   Words per subtitle: ${wordsPerSubtitle}, Animation: ${enableAnimation}`)

    const input: SubtitleInput = {
      video_url: videoUrl,
      language: 'fr', // French
      font_name: fontName,
      font_size: fontSize,
      font_weight: fontWeight,
      font_color: fontColor,
      highlight_color: highlightColor,
      stroke_width: strokeWidth,
      stroke_color: strokeColor,
      position: position,
      y_offset: yOffset,
      words_per_subtitle: wordsPerSubtitle,
      enable_animation: enableAnimation,
      background_color: 'none',
      background_opacity: 0,
    }

    // Use subscribe for synchronous result (with progress)
    const result = await fal.subscribe(AUTO_SUBTITLE_MODEL, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`   Subtitle generation in progress...`)
        }
      },
    }) as SubtitleOutput

    if (!result.video?.url) {
      throw new Error('No video URL in subtitle generation result')
    }

    console.log(`✅ Subtitles generated successfully`)
    console.log(`   Output video: ${result.video.url}`)
    console.log(`   Subtitle count: ${result.subtitle_count}`)

    return NextResponse.json({
      success: true,
      videoUrl: result.video.url,
      transcription: result.transcription,
      subtitleCount: result.subtitle_count,
    })

  } catch (error) {
    console.error('Error generating subtitles:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate subtitles', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}

