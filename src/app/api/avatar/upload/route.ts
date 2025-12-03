import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * GET /api/avatar/upload
 * Upload l'avatar Sud-Ouest sur Vercel Blob Storage
 * Retourne l'URL publique
 */
export async function GET() {
  try {
    // Lire l'image locale
    const avatarPath = path.join(process.cwd(), 'public', 'avatarsudsouest.png')
    const fileBuffer = await readFile(avatarPath)
    
    // Upload sur Vercel Blob Storage
    const blob = await put('avatars/sudouest-default.png', fileBuffer, {
      access: 'public',
      contentType: 'image/png',
    })
    
    console.log('Avatar uploaded to:', blob.url)
    
    return NextResponse.json({
      url: blob.url,
      success: true,
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'upload de l\'avatar',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

