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
 * Concatène plusieurs vidéos en une seule avec transitions fondu blanc
 * La dernière frame de chaque vidéo et la première frame de la suivante sont utilisées
 * pour créer une transition de 1 seconde (fondu blanc)
 */
export async function concatenateVideos(videoUrls: string[], withTransition: boolean = true): Promise<string> {
  if (videoUrls.length === 0) {
    throw new Error('No videos to concatenate')
  }

  if (videoUrls.length === 1) {
    // Une seule vidéo, pas besoin de concaténation
    return videoUrls[0]
  }

  await ensureDirectories()

  const tempDir = path.join(process.cwd(), 'public', 'temp')
  await fs.mkdir(tempDir, { recursive: true })

  const TRANSITION_DURATION = 1 // 1 seconde de transition

  // Télécharger et NORMALISER toutes les vidéos une par une
  console.log(`Downloading and normalizing ${videoUrls.length} videos...`)
  const normalizedPaths: string[] = []
  const videoDurations: number[] = []

  for (let i = 0; i < videoUrls.length; i++) {
    const videoUrl = videoUrls[i]
    const downloadPath = path.join(tempDir, `download-${i}.mp4`)
    const normalizedPath = path.join(tempDir, `normalized-${i}.mp4`)
    
    // Télécharger la vidéo
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
    
    console.log(`Downloaded ${i + 1}/${videoUrls.length}, normalizing...`)
    
    // Normaliser chaque vidéo au même format
    await new Promise<void>((resolve, reject) => {
      ffmpeg(downloadPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-r', '30',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-pix_fmt', 'yuv420p',
        ])
        .output(normalizedPath)
        .on('end', () => {
          console.log(`✅ Normalized video ${i + 1}/${videoUrls.length}`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`Error normalizing video ${i + 1}:`, err)
          reject(err)
        })
        .run()
    })
    
    // Get video duration for transition calculations
    const duration = await getVideoDurationFromFile(normalizedPath)
    videoDurations.push(duration)
    console.log(`   Duration: ${duration.toFixed(2)}s`)
    
    normalizedPaths.push(normalizedPath)
    // Supprimer le fichier téléchargé
    await fs.unlink(downloadPath).catch(() => {})
  }

  const outputPath = path.join(
    process.cwd(),
    'public',
    'videos',
    `concatenated-${Date.now()}.mp4`
  )

  // If only 2 videos or transitions disabled, use simple xfade
  if (!withTransition || normalizedPaths.length === 2) {
    return concatenateWithTransitions(normalizedPaths, videoDurations, outputPath, tempDir, TRANSITION_DURATION, withTransition)
  }

  // For multiple videos, chain xfade filters
  return concatenateWithTransitions(normalizedPaths, videoDurations, outputPath, tempDir, TRANSITION_DURATION, withTransition)
}

/**
 * Concatenate videos with white fade transitions between them
 */
async function concatenateWithTransitions(
  videoPaths: string[],
  durations: number[],
  outputPath: string,
  tempDir: string,
  transitionDuration: number,
  withTransition: boolean
): Promise<string> {
  if (!withTransition) {
    // Simple concat without transitions
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

  console.log(`🎬 Concatenating ${videoPaths.length} videos with white fade transitions...`)

  // Build complex filter for xfade transitions
  // xfade with fadewhite transition keeps last frame of video A and first frame of video B
  // and creates a smooth white fade between them
  
  let filterComplex = ''
  let currentVideoStream = '[0:v]'
  let currentAudioStream = '[0:a]'
  let offset = durations[0] - transitionDuration

  for (let i = 1; i < videoPaths.length; i++) {
    const outVideoLabel = i === videoPaths.length - 1 ? '[outv]' : `[v${i}]`
    const outAudioLabel = i === videoPaths.length - 1 ? '[outa]' : `[a${i}]`
    
    // Video: xfade with fadewhite (white flash transition)
    filterComplex += `${currentVideoStream}[${i}:v]xfade=transition=fadewhite:duration=${transitionDuration}:offset=${offset.toFixed(3)}${outVideoLabel};`
    
    // Audio: acrossfade
    filterComplex += `${currentAudioStream}[${i}:a]acrossfade=d=${transitionDuration}${outAudioLabel};`
    
    currentVideoStream = outVideoLabel
    currentAudioStream = outAudioLabel
    
    // Update offset for next transition
    // offset = cumulative_duration - (number_of_transitions * transition_duration)
    if (i < videoPaths.length - 1) {
      offset += durations[i] - transitionDuration
    }
  }

  // Remove trailing semicolon
  filterComplex = filterComplex.slice(0, -1)

  return new Promise((resolve, reject) => {
    let command = ffmpeg()
    
    // Add all video inputs
    for (const videoPath of videoPaths) {
      command = command.input(videoPath)
    }
    
    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg xfade command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log(`Processing transitions: ${progress.percent?.toFixed(2)}% done`)
      })
      .on('end', async () => {
        console.log('✅ Concatenation with transitions finished')
        await cleanupFiles(videoPaths, [])
        resolve(outputPath)
      })
      .on('error', async (err) => {
        console.error('FFmpeg xfade error:', err)
        // Fallback to simple concat without transitions
        console.log('⚠️ Falling back to simple concatenation...')
        try {
          const result = await concatenateWithTransitions(videoPaths, durations, outputPath, tempDir, transitionDuration, false)
          resolve(result)
        } catch (fallbackErr) {
          reject(fallbackErr)
        }
      })
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

