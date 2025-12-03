import { ScrapedArticle } from '@/types'

/**
 * URLs des flux RSS de Sud-Ouest
 */
const RSS_FEEDS = {
  main: 'https://www.sudouest.fr/gironde/bordeaux/rss.xml',
  actualites: 'https://www.sudouest.fr/actualites/rss.xml',
  france: 'https://www.sudouest.fr/france/rss.xml',
  bordeaux: 'https://www.sudouest.fr/bordeaux/rss.xml',
  // Ajouter d'autres flux selon besoin
}

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  category?: string
  enclosure?: {
    url: string
    type: string
  }
}

/**
 * Parse un flux RSS et extrait les articles
 */
async function parseRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    console.log(`Fetching RSS from: ${feedUrl}`)
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SudOuestPodcaster/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.text()
    console.log(`Received ${data.length} characters from RSS`)
    
    // Import dynamique de cheerio côté serveur uniquement
    const cheerio = await import('cheerio')
    const $ = cheerio.load(data, { xmlMode: true })
    const items: RSSItem[] = []

    console.log(`Found ${$('item').length} <item> elements`)

    $('item').each((_, element) => {
      const $item = $(element)
      
      const item: RSSItem = {
        title: $item.find('title').text().trim(),
        link: $item.find('link').text().trim(),
        description: $item.find('description').text().trim(),
        pubDate: $item.find('pubDate').text().trim(),
        category: $item.find('category').first().text().trim() || undefined,
      }

      // Récupérer l'image si disponible
      const enclosure = $item.find('enclosure')
      if (enclosure.length > 0) {
        item.enclosure = {
          url: enclosure.attr('url') || '',
          type: enclosure.attr('type') || 'image/jpeg',
        }
      }

      // Alternative: chercher l'image dans media:content ou media:thumbnail
      const mediaContent = $item.find('media\\:content, content')
      if (mediaContent.length > 0 && !item.enclosure) {
        item.enclosure = {
          url: mediaContent.attr('url') || '',
          type: 'image/jpeg',
        }
      }

      if (item.title && item.link) {
        items.push(item)
      }
    })

    return items
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error)
    return []
  }
}

/**
 * Scrape le contenu complet d'un article depuis son URL
 */
async function scrapeArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SudOuestPodcaster/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    
    // Import dynamique de cheerio
    const cheerio = await import('cheerio')
    const $ = cheerio.load(html)

    // Sélecteurs possibles pour le contenu de l'article
    // À ajuster selon la structure HTML réelle de Sud-Ouest
    let content = ''

    // Essayer différents sélecteurs communs
    const possibleSelectors = [
      'article .article-content',
      'article .content',
      '.article-body',
      '.article-text',
      'article p',
      '.story-body p',
      'main article p',
    ]

    for (const selector of possibleSelectors) {
      const elements = $(selector)
      if (elements.length > 0) {
        content = elements
          .map((_, el) => $(el).text().trim())
          .get()
          .join('\n\n')
        
        if (content.length > 100) {
          break
        }
      }
    }

    // Si on n'a pas trouvé de contenu substantiel, utiliser la description RSS
    if (content.length < 100) {
      return ''
    }

    return content
  } catch (error) {
    console.error(`Error scraping article ${url}:`, error)
    return ''
  }
}

/**
 * Récupère les articles du jour depuis les flux RSS
 */
export async function fetchTodayArticles(maxArticles = 20, feedUrl?: string): Promise<ScrapedArticle[]> {
  const urlToFetch = feedUrl || RSS_FEEDS.main
  console.log(`Fetching articles from RSS feed: ${urlToFetch}`)

  // Récupérer les articles depuis le flux spécifié
  const rssItems = await parseRSSFeed(urlToFetch)
  console.log(`Parsed ${rssItems.length} items from RSS feed`)

  // Prendre simplement les N derniers articles (le flux RSS est déjà trié par date)
  // On ne filtre pas par date pour gérer les erreurs potentielles du flux RSS
  const todayArticles = rssItems.slice(0, maxArticles)

  console.log(`Selected ${todayArticles.length} most recent articles`)
  
  if (todayArticles.length > 0) {
    const firstDate = new Date(todayArticles[0].pubDate)
    const lastDate = new Date(todayArticles[todayArticles.length - 1].pubDate)
    console.log(`Date range: ${firstDate.toLocaleDateString('fr-FR')} to ${lastDate.toLocaleDateString('fr-FR')}`)
  }

  // Enrichir avec le contenu complet
  const enrichedArticles: ScrapedArticle[] = await Promise.all(
    todayArticles.map(async (item) => {
      const fullContent = await scrapeArticleContent(item.link)
      const cleanSummary = await cleanHtmlText(item.description)
      const cleanContent = fullContent || cleanSummary

      return {
        title: item.title,
        summary: cleanSummary,
        content: cleanContent,
        url: item.link,
        imageUrl: item.enclosure?.url,
        category: item.category,
        publishedAt: new Date(item.pubDate),
      }
    })
  )

  // Trier par date de publication (plus récent en premier)
  return enrichedArticles.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  )
}

/**
 * Nettoie le texte HTML (enlève les balises et entités HTML)
 */
async function cleanHtmlText(html: string): Promise<string> {
  const cheerio = await import('cheerio')
  const $ = cheerio.load(html)
  return $.text()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
}

/**
 * Teste la connexion aux flux RSS
 */
export async function testRSSConnection(): Promise<{
  success: boolean
  articlesCount: number
  error?: string
}> {
  try {
    const items = await parseRSSFeed(RSS_FEEDS.main)
    return {
      success: true,
      articlesCount: items.length,
    }
  } catch (error) {
    return {
      success: false,
      articlesCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

