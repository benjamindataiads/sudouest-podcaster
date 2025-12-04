'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArticleWithScore } from '@/types'
import { Loader2 } from 'lucide-react'

interface StepOneProps {
  onComplete: (articles: ArticleWithScore[]) => void
  onSkipToCustomScript?: () => void
}

const RSS_FEEDS = [
  { value: 'bordeaux', label: 'Bordeaux - Actualités générales', url: 'https://www.sudouest.fr/gironde/bordeaux/rss.xml' },
  { value: 'faits-divers', label: 'Faits divers', url: 'https://www.sudouest.fr/faits-divers/rss.xml' },
  { value: 'rugby', label: 'Rugby - Bordeaux-Bègles', url: 'https://www.sudouest.fr/sport/rugby/bordeaux-begles/rss.xml' },
]

export default function StepOne({ onComplete, onSkipToCustomScript }: StepOneProps) {
  const [articles, setArticles] = useState<ArticleWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [error, setError] = useState<string>('')
  const [selectedFeed, setSelectedFeed] = useState<string>('bordeaux')

  useEffect(() => {
    fetchArticles()
  }, [selectedFeed])

  const fetchArticles = async () => {
    try {
      setLoading(true)
      setError('')
      setAnalyzed(false)
      
      const feed = RSS_FEEDS.find(f => f.value === selectedFeed)
      const response = await fetch(`/api/articles?feedUrl=${encodeURIComponent(feed?.url || RSS_FEEDS[0].url)}`)
      
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des articles')
      }

      const data = await response.json()
      setArticles(data.articles)
      setAnalyzed(data.analyzed || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const analyzeWithAI = async (analysisType: 'general' | 'fun' | 'faits-divers' | 'politique' | 'sport') => {
    try {
      setAnalyzing(true)
      setError('')
      
      const response = await fetch('/api/articles/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles, analysisType }),
      })
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse IA')
      }

      const data = await response.json()
      setArticles(data.articles)
      setAnalyzed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse IA')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleArticle = (id: number) => {
    setArticles(articles.map(article => 
      article.id === id 
        ? { ...article, selected: !article.selected }
        : article
    ))
  }

  const handleContinue = () => {
    const selected = articles.filter(a => a.selected)
    
    if (selected.length === 0) {
      alert('Veuillez sélectionner au moins un article')
      return
    }

    onComplete(selected)
  }

  const selectedCount = articles.filter(a => a.selected).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Récupération des articles du jour...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Erreur</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchArticles}>Réessayer</Button>
        </CardContent>
      </Card>
    )
  }

  // Organiser par catégorie
  const categories = new Map<string, ArticleWithScore[]>()
  articles.forEach(article => {
    const category = article.category || 'Non catégorisé'
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)?.push(article)
  })

  return (
    <div className="space-y-6">
      {/* Option to skip articles and write custom script */}
      {onSkipToCustomScript && (
        <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Vous souhaitez écrire votre propre script ?</h3>
                <p className="text-sm text-gray-500">Sautez la sélection d&apos;articles et rédigez directement votre contenu</p>
              </div>
              <Button variant="outline" onClick={onSkipToCustomScript}>
                Écrire un script personnalisé
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Articles du jour</CardTitle>
            <CardDescription>
              {articles.length} articles disponibles • {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* Sélecteur de flux RSS */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label htmlFor="feed-select" className="block text-sm font-medium text-gray-700 mb-2">
              Source des articles
            </label>
            <select
              id="feed-select"
              value={selectedFeed}
              onChange={(e) => setSelectedFeed(e.target.value)}
              disabled={loading || analyzing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {RSS_FEEDS.map((feed) => (
                <option key={feed.value} value={feed.value}>
                  {feed.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Changez de source pour voir différents articles. Les articles seront rechargés automatiquement.
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {analyzed 
              ? "L'IA a analysé et sélectionné les 5 articles les plus intéressants. Vous pouvez modifier la sélection ci-dessous ou relancer une analyse avec un autre type."
              : "Les 5 premiers articles sont pré-sélectionnés. Choisissez un type d'analyse IA ou modifiez manuellement la sélection."
            }
          </p>
          
          {/* Boutons d'analyse par type */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Button 
              onClick={() => analyzeWithAI('fun')} 
              disabled={analyzing}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">😄</span>
                  <span className="font-semibold">Fun</span>
                  <span className="text-xs text-gray-500">Insolite & léger</span>
                </>
              )}
            </Button>

            <Button 
              onClick={() => analyzeWithAI('faits-divers')} 
              disabled={analyzing}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">🚨</span>
                  <span className="font-semibold">Faits divers</span>
                  <span className="text-xs text-gray-500">Événements locaux</span>
                </>
              )}
            </Button>

            <Button 
              onClick={() => analyzeWithAI('politique')} 
              disabled={analyzing}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">🏛️</span>
                  <span className="font-semibold">Politique</span>
                  <span className="text-xs text-gray-500">Analyses politiques</span>
                </>
              )}
            </Button>

            <Button 
              onClick={() => analyzeWithAI('sport')} 
              disabled={analyzing}
              variant="outline"
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span className="text-2xl">⚽</span>
                  <span className="font-semibold">Sport</span>
                  <span className="text-xs text-gray-500">Actualités sportives</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Articles par catégorie */}
      {Array.from(categories.entries()).map(([category, categoryArticles]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-3 text-gray-800">{category}</h3>
          <div className="space-y-3">
            {categoryArticles.map(article => (
              <Card 
                key={article.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  article.selected ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => toggleArticle(article.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      checked={article.selected}
                      onCheckedChange={() => toggleArticle(article.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {article.title}
                        </h4>
                        <span className={`
                          ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                          ${article.score >= 80 ? 'bg-green-100 text-green-800' : ''}
                          ${article.score >= 60 && article.score < 80 ? 'bg-blue-100 text-blue-800' : ''}
                          ${article.score < 60 ? 'bg-gray-100 text-gray-800' : ''}
                        `}>
                          Score: {article.score}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {article.summary}
                      </p>
                      {article.imageUrl && (
                        <img 
                          src={article.imageUrl} 
                          alt={article.title}
                          className="w-full h-48 object-cover rounded mt-2"
                        />
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>{new Date(article.publishedAt).toLocaleTimeString('fr-FR')}</span>
                        <a 
                          href={article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Voir l&apos;article
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={fetchArticles}>
          Rafraîchir
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={selectedCount === 0}
          size="lg"
        >
          Continuer avec {selectedCount} article{selectedCount > 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  )
}

