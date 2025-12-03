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
 * Concatène plusieurs vidéos en une seule
 * Télécharge les vidéos depuis leurs URLs, les concatène, puis retourne le chemin local
 */
export async function concatenateVideos(videoUrls: string[]): Promise<string> {
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

  // Télécharger et NORMALISER toutes les vidéos une par une
  console.log(`Downloading and normalizing ${videoUrls.length} videos...`)
  const normalizedPaths: string[] = []

  for (let i = 0; i < videoUrls.length; i++) {
    let videoUrl = videoUrls[i]
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
    
    normalizedPaths.push(normalizedPath)
    // Supprimer le fichier téléchargé
    await fs.unlink(downloadPath).catch(() => {})
  }

  // Créer un fichier de liste pour concat
  const listPath = path.join(tempDir, 'filelist.txt')
  const listContent = normalizedPaths.map(p => `file '${p}'`).join('\n')
  await fs.writeFile(listPath, listContent)

  const outputPath = path.join(
    process.cwd(),
    'public',
    'videos',
    `concatenated-${Date.now()}.mp4`
  )

  return new Promise((resolve, reject) => {
    console.log('Concatenating normalized videos (simple copy)...')
    
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c', 'copy',             // Maintenant on peut copier car tout est normalisé!
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg concat command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log(`Concatenating: ${progress.percent?.toFixed(2)}% done`)
      })
      .on('end', async () => {
        console.log('✅ Concatenation finished')
        
        // Nettoyer les fichiers temporaires
        try {
          for (const normalizedPath of normalizedPaths) {
            await fs.unlink(normalizedPath)
          }
          await fs.unlink(listPath)
          console.log('Temporary files cleaned up')
        } catch (cleanupError) {
          console.warn('Error cleaning up temp files:', cleanupError)
        }
        
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('FFmpeg concatenation error:', err)
        reject(err)
      })
      .run()
  })
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

