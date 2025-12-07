import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes for large merges
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { put } from '@vercel/blob'

/**
 * POST /api/audio/merge
 * Merge multiple audio files using FFmpeg and upload to Vercel Blob
 * Supports both legacy (url1, url2) and new (audioUrls array) formats
 */
export async function POST(request: NextRequest) {
  const tempFiles: string[] = []
  
  try {
    const body = await request.json()
    
    // Support both old format (url1, url2) and new format (audioUrls array)
    let urls: string[] = []
    const batchIndex = body.batchIndex || Date.now()
    
    if (body.audioUrls && Array.isArray(body.audioUrls)) {
      urls = body.audioUrls
    } else if (body.url1 && body.url2) {
      urls = [body.url1, body.url2]
    } else {
      return NextResponse.json(
        { error: 'audioUrls array or url1+url2 required' },
        { status: 400 }
      )
    }

    if (urls.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 audio URLs required' },
        { status: 400 }
      )
    }

    console.log(`🔗 Merging ${urls.length} audio files...`)

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'public', 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    const timestamp = Date.now()
    const outputPath = path.join(tempDir, `merged_${batchIndex}_${timestamp}.mp3`)
    const listFile = path.join(tempDir, `list_${batchIndex}_${timestamp}.txt`)
    tempFiles.push(listFile, outputPath)

    // Download all audio files in parallel
    console.log(`📥 Downloading ${urls.length} audio files...`)
    const downloadPromises = urls.map(async (url, index) => {
      const tempPath = path.join(tempDir, `audio_${batchIndex}_${index}_${timestamp}.mp3`)
      tempFiles.push(tempPath)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download audio ${index + 1}: ${response.status}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(tempPath, buffer)
      
      console.log(`  ✅ Downloaded audio ${index + 1}/${urls.length}`)
      return tempPath
    })

    const downloadedPaths = await Promise.all(downloadPromises)

    // Create FFmpeg concat list file
    const listContent = downloadedPaths.map(p => `file '${p}'`).join('\n')
    await fs.writeFile(listFile, listContent)

    // Merge with FFmpeg
    console.log(`🎬 Merging with FFmpeg...`)
    execSync(
      `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}" -y`,
      { stdio: 'pipe' }
    )

    // Upload merged file to Vercel Blob
    console.log('📤 Uploading merged audio to Vercel Blob...')
    const mergedBuffer = await fs.readFile(outputPath)
    const blob = await put(`audio/merged_${batchIndex}_${timestamp}.mp3`, mergedBuffer, {
      access: 'public',
      contentType: 'audio/mpeg',
    })

    // Cleanup temp files
    console.log('🧹 Cleaning up temp files...')
    await Promise.all(tempFiles.map(f => fs.unlink(f).catch(() => {})))

    console.log(`✅ Merged audio uploaded: ${blob.url}`)

    return NextResponse.json({
      audioUrl: blob.url,
      url: blob.url, // Legacy compatibility
      success: true,
      mergedCount: urls.length,
    })
  } catch (error) {
    // Cleanup on error
    await Promise.all(tempFiles.map(f => fs.unlink(f).catch(() => {})))

    console.error('Error merging audio files:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors de la fusion des fichiers audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

