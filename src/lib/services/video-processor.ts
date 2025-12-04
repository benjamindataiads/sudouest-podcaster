import 'server-only'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import { formatDate } from '@/lib/utils'

interface AddOverlayOptions {
  videoUrl: string
  outputPath: string
  logoPath: string
  date: Date
  captionsPath?: string
}

/**
 * Ajoute le logo Sud-Ouest, la date et optionnellement les sous-titres à la vidéo
 */
export async function addOverlaysToVideo({
  videoUrl,
  outputPath,
  logoPath,
  date,
  captionsPath,
}: AddOverlayOptions): Promise<string> {
  // S'assurer que le dossier de destination existe
  const outputDir = path.dirname(outputPath)
  await fs.mkdir(outputDir, { recursive: true })
  console.log(`✅ Ensured directory exists: ${outputDir}`)
  
  return new Promise((resolve, reject) => {
    const dateText = formatDate(date)
    
    let command = ffmpeg(videoUrl)
      .input(logoPath)
      .complexFilter([
        // Logo en haut à droite (position: 20px du bord)
        '[1:v]scale=120:-1[logo]',
        '[0:v][logo]overlay=W-w-20:20[v1]',
        
        // Date en bas à gauche
        `[v1]drawtext=text='${dateText}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=24:fontcolor=white:x=20:y=H-th-20:box=1:boxcolor=black@0.5:boxborderw=5[v2]`,
      ])
      .outputOptions([
        '-map', '[v2]',
        '-map', '0:a',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'copy',
      ])

    // Ajouter les sous-titres si disponibles
    if (captionsPath) {
      command = command.outputOptions([
        '-vf', `subtitles=${captionsPath}:force_style='FontName=Arial,FontSize=20,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'`
      ])
    }

    command
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent?.toFixed(2)}% done`)
      })
      .on('end', () => {
        console.log('Video processing finished')
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * Extrait la durée d'une vidéo
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      
      const duration = metadata.format.duration || 0
      resolve(Math.floor(duration))
    })
  })
}

/**
 * Convertit un audio en format MP3 optimisé
 */
export async function convertToMP3(
  inputPath: string,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(2)
      .audioFrequency(44100)
      .output(outputPath)
      .on('end', () => {
        console.log('MP3 conversion finished')
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('MP3 conversion error:', err)
        reject(err)
      })
      .run()
  })
}

/**
 * Génère une image miniature depuis une vidéo
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timeInSeconds = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timeInSeconds],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x720',
      })
      .on('end', () => {
        console.log('Thumbnail generated')
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('Thumbnail error:', err)
        reject(err)
      })
  })
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDurationFromFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      const duration = metadata.format.duration || 0
      resolve(duration)
    })
  })
}

/**
 * Add fade effects to video: fade out to white at end, fade in from white at start
 * Keeps audio perfectly in sync (no duration change)
 */
async function addFadesToVideo(
  inputPath: string,
  outputPath: string,
  videoDuration: number,
  options: {
    fadeInFromWhite: boolean
    fadeOutToWhite: boolean
    fadeDuration: number
  }
): Promise<void> {
  const { fadeInFromWhite, fadeOutToWhite, fadeDuration } = options
  const fadeOutStart = Math.max(0, videoDuration - fadeDuration)
  
  // Build video filters
  const videoFilters: string[] = []
  
  if (fadeInFromWhite) {
    videoFilters.push(`fade=t=in:st=0:d=${fadeDuration}:c=white`)
  }
  if (fadeOutToWhite) {
    videoFilters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration}:c=white`)
  }
  
  // Build audio filters
  const audioFilters: string[] = []
  
  if (fadeInFromWhite) {
    audioFilters.push(`afade=t=in:st=0:d=${fadeDuration}`)
  }
  if (fadeOutToWhite) {
    audioFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration}`)
  }
  
  // If no fades needed, just copy
  if (videoFilters.length === 0) {
    await fs.copyFile(inputPath, outputPath)
    return
  }
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
    
    // Apply video filters
    command = command.videoFilters(videoFilters)
    
    // Apply audio filters if any
    if (audioFilters.length > 0) {
      command = command.audioFilters(audioFilters)
    }
    
    command
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // Much faster encoding
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2', // Force stereo
        '-pix_fmt', 'yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run()
  })
}

/**
 * Concatène plusieurs vidéos avec transitions fondu blanc
 * SANS couper de contenu - l'audio reste parfaitement synchronisé
 * 
 * Approche: 
 * - Video 1: fondu vers blanc à la fin
 * - Videos du milieu: fondu depuis blanc au début + fondu vers blanc à la fin
 * - Dernière video: fondu depuis blanc au début
 * - Simple concat (les vidéos gardent leur durée originale)
 */
export async function concatenateVideos(videoUrls: string[], withTransition: boolean = true): Promise<string> {
  if (videoUrls.length === 0) {
    throw new Error('No videos to concatenate')
  }

  if (videoUrls.length === 1) {
    return videoUrls[0]
  }

  await ensureDirectories()

  const tempDir = path.join(process.cwd(), 'public', 'temp')
  await fs.mkdir(tempDir, { recursive: true })

  const FADE_DURATION = 0.5 // Durée du fondu (0.5s = transition totale de 1s car fade out + fade in)

  console.log(`📥 Downloading and normalizing ${videoUrls.length} videos...`)
  const normalizedPaths: string[] = []
  const videoDurations: number[] = []

  // Step 1: Download and normalize all videos
  for (let i = 0; i < videoUrls.length; i++) {
    const videoUrl = videoUrls[i]
    const downloadPath = path.join(tempDir, `download-${i}.mp4`)
    const normalizedPath = path.join(tempDir, `normalized-${i}.mp4`)
    
    if (videoUrl.startsWith('/')) {
      const fullLocalPath = path.join(process.cwd(), 'public', videoUrl)
      const fileContent = await fs.readFile(fullLocalPath)
      await fs.writeFile(downloadPath, fileContent)
    } else {
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`Failed to download video ${i + 1}`)
      }
      const buffer = await response.arrayBuffer()
      await fs.writeFile(downloadPath, Buffer.from(buffer))
    }
    
    console.log(`   Downloaded ${i + 1}/${videoUrls.length}, normalizing...`)
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(downloadPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'ultrafast', // Much faster encoding
          '-crf', '23',
          '-r', '30',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2', // Force stereo (2 channels)
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', // EBU R128 loudness normalization
          '-pix_fmt', 'yuv420p',
        ])
        .output(normalizedPath)
        .on('end', () => {
          console.log(`   ✅ Normalized video ${i + 1}/${videoUrls.length}`)
          resolve()
        })
        .on('error', reject)
        .run()
    })
    
    const duration = await getVideoDurationFromFile(normalizedPath)
    videoDurations.push(duration)
    normalizedPaths.push(normalizedPath)
    await fs.unlink(downloadPath).catch(() => {})
  }

  const outputPath = path.join(process.cwd(), 'public', 'videos', `concatenated-${Date.now()}.mp4`)

  if (!withTransition) {
    return simpleConcat(normalizedPaths, outputPath, tempDir)
  }

  console.log(`🎬 Adding white fade transitions (audio stays in sync)...`)

  // Step 2: Add fade effects to each video
  const fadedPaths: string[] = []
  const allTempFiles: string[] = [...normalizedPaths]

  for (let i = 0; i < normalizedPaths.length; i++) {
    const fadedPath = path.join(tempDir, `faded-${i}.mp4`)
    
    const isFirst = i === 0
    const isLast = i === normalizedPaths.length - 1
    
    console.log(`   Processing video ${i + 1}/${normalizedPaths.length}...`)
    
    await addFadesToVideo(normalizedPaths[i], fadedPath, videoDurations[i], {
      fadeInFromWhite: !isFirst, // Not first = fade in from white
      fadeOutToWhite: !isLast,   // Not last = fade out to white
      fadeDuration: FADE_DURATION,
    })
    
    fadedPaths.push(fadedPath)
    allTempFiles.push(fadedPath)
  }

  // Step 3: Simple concat (no overlap, no duration change = audio stays in sync)
  console.log(`🔗 Concatenating ${fadedPaths.length} videos...`)
  
  const listPath = path.join(tempDir, 'filelist.txt')
  const listContent = fadedPaths.map(p => `file '${p}'`).join('\n')
  await fs.writeFile(listPath, listContent)
  allTempFiles.push(listPath)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c', 'copy', // Stream copy - no re-encoding (videos already have same format)
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('FFmpeg concat:', cmd.substring(0, 200) + '...'))
      .on('progress', (p) => {
        if (p.percent) console.log(`   Progress: ${p.percent.toFixed(1)}%`)
      })
      .on('end', async () => {
        console.log('✅ Concatenation with white fades complete (audio in sync)')
        await cleanupFiles(allTempFiles, [])
        resolve(outputPath)
      })
      .on('error', async (err) => {
        console.error('FFmpeg error:', err)
        console.log('⚠️ Falling back to simple concatenation...')
        try {
          await cleanupFiles(allTempFiles.filter(f => !normalizedPaths.includes(f)), [])
          const result = await simpleConcat(normalizedPaths, outputPath, tempDir)
          resolve(result)
        } catch (fallbackErr) {
          reject(fallbackErr)
        }
      })
      .run()
  })
}

/**
 * Simple concatenation without transitions
 */
async function simpleConcat(videoPaths: string[], outputPath: string, tempDir: string): Promise<string> {
  const listPath = path.join(tempDir, 'filelist.txt')
  const listContent = videoPaths.map(p => `file '${p}'`).join('\n')
  await fs.writeFile(listPath, listContent)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', async () => {
        await cleanupFiles(videoPaths, [listPath])
        resolve(outputPath)
      })
      .on('error', reject)
      .run()
  })
}

/**
 * Clean up temporary files
 */
async function cleanupFiles(videoPaths: string[], otherFiles: string[]): Promise<void> {
  try {
    for (const filePath of [...videoPaths, ...otherFiles]) {
      await fs.unlink(filePath).catch(() => {})
    }
    console.log('Temporary files cleaned up')
  } catch (err) {
    console.warn('Error cleaning up temp files:', err)
  }
}

/**
 * Prépare les dossiers nécessaires pour le traitement vidéo
 */
export async function ensureDirectories() {
  const dirs = [
    path.join(process.cwd(), 'public', 'uploads'),
    path.join(process.cwd(), 'public', 'videos'),
    path.join(process.cwd(), 'public', 'audio'),
    path.join(process.cwd(), 'public', 'thumbnails'),
    path.join(process.cwd(), 'public', 'temp'),
  ]

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}
