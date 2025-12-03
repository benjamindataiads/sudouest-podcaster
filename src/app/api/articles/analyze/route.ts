import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { analyzeAndSelectArticles, AnalysisType } from '@/lib/services/ai'
import { ScrapedArticle } from '@/types'

/**
 * POST /api/articles/analyze
 * Analyse les articles avec l'IA et attribue des scores
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articles, analysisType = 'general' } = body

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: 'Articles requis' },
        { status: 400 }
      )
    }

    const validAnalysisTypes: AnalysisType[] = ['general', 'fun', 'faits-divers', 'politique', 'sport']
    if (!validAnalysisTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: 'Type d\'analyse invalide' },
        { status: 400 }
      )
    }

    console.log(`Starting AI analysis (${analysisType}) for ${articles.length} articles...`)
    
    // Analyser et attribuer des scores avec l'IA
    const analyzedArticles = await analyzeAndSelectArticles(
      articles as ScrapedArticle[], 
      analysisType as AnalysisType
    )
    console.log(`AI analysis complete`)

    return NextResponse.json({
      articles: analyzedArticles,
      count: analyzedArticles.length,
      analyzed: true,
      analysisType,
    })
  } catch (error) {
    console.error('Error in /api/articles/analyze:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'analyse des articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

