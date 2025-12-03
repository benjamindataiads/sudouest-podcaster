import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avatar/upload
 * Upload l'avatar Sud-Ouest sur Vercel Blob Storage
 * Retourne l'URL publique (or use local URL if not on Vercel)
 */
export async function GET() {
  try {
    // If not on Vercel (no BLOB_READ_WRITE_TOKEN), return local URL
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      return NextResponse.json({
        url: `${baseUrl}/avatarsudsouest.png`,
        success: true,
      })
    }
    
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

