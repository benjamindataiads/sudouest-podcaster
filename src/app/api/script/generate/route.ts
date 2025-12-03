import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { generatePodcastScript } from '@/lib/services/ai'
import { ScrapedArticle } from '@/types'

/**
 * POST /api/script/generate
 * Génère un script de podcast à partir des articles sélectionnés
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articles, targetDuration = 240 } = body

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: 'Articles requis' },
        { status: 400 }
      )
    }

    console.log(`Generating script for ${articles.length} articles...`)

    // Générer le script directement avec les articles fournis
    const script = await generatePodcastScript(
      articles as ScrapedArticle[],
      targetDuration
    )

    console.log('Script generated successfully')

    return NextResponse.json({
      script,
      articleCount: articles.length,
    })
  } catch (error) {
    console.error('Error generating script:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération du script',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

