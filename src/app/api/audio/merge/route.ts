import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { put } from '@vercel/blob'

/**
 * POST /api/audio/merge
 * Merge deux fichiers audio en utilisant FFmpeg et upload sur Vercel Blob
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url1, url2, batchIndex } = body

    if (!url1 || !url2) {
      return NextResponse.json(
        { error: 'Deux URLs audio sont requises' },
        { status: 400 }
      )
    }

    console.log(`Merging audio chunks ${batchIndex}: ${url1} + ${url2}`)

    // Créer le dossier temp si nécessaire
    const tempDir = path.join(process.cwd(), 'public', 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    // Paths locaux temporaires
    const temp1 = path.join(tempDir, `audio1_${batchIndex}_${Date.now()}.mp3`)
    const temp2 = path.join(tempDir, `audio2_${batchIndex}_${Date.now()}.mp3`)
    const outputPath = path.join(tempDir, `merged_${batchIndex}_${Date.now()}.mp3`)
    const listFile = path.join(tempDir, `list_${batchIndex}_${Date.now()}.txt`)

    try {
      // Télécharger les fichiers audio
      console.log(`Downloading audio 1...`)
      const audio1Response = await fetch(url1)
      const audio1Buffer = Buffer.from(await audio1Response.arrayBuffer())
      await fs.writeFile(temp1, audio1Buffer)

      console.log(`Downloading audio 2...`)
      const audio2Response = await fetch(url2)
      const audio2Buffer = Buffer.from(await audio2Response.arrayBuffer())
      await fs.writeFile(temp2, audio2Buffer)

      // Créer le fichier de liste pour FFmpeg
      const listContent = `file '${temp1}'\nfile '${temp2}'`
      await fs.writeFile(listFile, listContent)

      // Merger avec FFmpeg
      console.log(`Merging audio files with FFmpeg...`)
      execSync(
        `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}" -y`,
        { stdio: 'pipe' }
      )

      // Upload le fichier mergé sur Vercel Blob pour le rendre accessible publiquement
      console.log('Uploading merged audio to Vercel Blob...')
      const mergedBuffer = await fs.readFile(outputPath)
      const blob = await put(`audio/merged_${batchIndex}_${Date.now()}.mp3`, mergedBuffer, {
        access: 'public',
        contentType: 'audio/mpeg',
      })

      // Nettoyer les fichiers temporaires
      await fs.unlink(temp1)
      await fs.unlink(temp2)
      await fs.unlink(listFile)
      await fs.unlink(outputPath)

      console.log(`✅ Merged audio uploaded to: ${blob.url}`)

      return NextResponse.json({
        url: blob.url,
        success: true,
      })
    } catch (error) {
      // Nettoyer en cas d'erreur
      try {
        await fs.unlink(temp1).catch(() => {})
        await fs.unlink(temp2).catch(() => {})
        await fs.unlink(listFile).catch(() => {})
        await fs.unlink(outputPath).catch(() => {})
      } catch {}

      throw error
    }
  } catch (error) {
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

