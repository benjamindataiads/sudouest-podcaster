import { NextRequest, NextResponse } from 'next/server'
import { fetchTodayArticles } from '@/lib/services/scraper'
import { analyzeAndSelectArticles } from '@/lib/services/ai'

/**
 * GET /api/articles
 * Récupère les articles du jour et les analyse
 */
export async function GET(request: NextRequest) {
  try {
    console.log('API /api/articles called')
    
    // Récupérer l'URL du flux RSS depuis les query params
    const searchParams = request.nextUrl.searchParams
    const feedUrl = searchParams.get('feedUrl') || 'https://www.sudouest.fr/gironde/bordeaux/rss.xml'
    
    console.log(`Fetching from RSS feed: ${feedUrl}`)
    
    // Récupérer les articles depuis le RSS
    const articles = await fetchTodayArticles(20, feedUrl)
    console.log(`Fetched ${articles.length} articles from RSS`)

    if (articles.length === 0) {
      return NextResponse.json(
        { error: 'Aucun article trouvé pour aujourd\'hui' },
        { status: 404 }
      )
    }

    // Retourner les articles avec un score par défaut, sans analyse IA
    const articlesWithScore = articles.map((article, idx) => ({
      ...article,
      id: idx,
      score: 50, // Score neutre par défaut
      selected: idx < 5, // Pré-sélectionner les 5 premiers
    }))

    return NextResponse.json({
      articles: articlesWithScore,
      count: articlesWithScore.length,
      date: new Date().toISOString(),
      analyzed: false, // Indique que l'analyse IA n'a pas été faite
    })
  } catch (error) {
    console.error('Error in /api/articles:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de la récupération des articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

