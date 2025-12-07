import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // 30 seconds timeout for scraping

/**
 * POST /api/audio-article/scrape
 * Scrape article text from a URL
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { url } = body

    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }

    console.log(`🔍 Scraping article from: ${parsedUrl.href}`)

    // Fetch the page
    const response = await fetch(parsedUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AudioArticleBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Impossible de récupérer la page (${response.status})` 
      }, { status: 400 })
    }

    const html = await response.text()

    // Extract article content using regex-based extraction
    // This is a simplified approach - works for most news sites
    const articleText = extractArticleText(html)
    const title = extractTitle(html)

    if (!articleText || articleText.length < 100) {
      return NextResponse.json({ 
        error: 'Impossible d\'extraire le contenu de l\'article. Essayez de copier-coller manuellement.' 
      }, { status: 400 })
    }

    console.log(`✅ Scraped article: "${title}" (${articleText.length} chars)`)

    return NextResponse.json({
      title: title || 'Article sans titre',
      text: articleText,
      url: parsedUrl.href,
      charCount: articleText.length,
    })
  } catch (error) {
    console.error('Error scraping article:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du scraping',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Extract article title from HTML
 */
function extractTitle(html: string): string {
  // Try og:title first
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogTitleMatch) return cleanText(ogTitleMatch[1])

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return cleanText(titleMatch[1])

  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return cleanText(h1Match[1])

  return ''
}

/**
 * Extract main article text from HTML
 * Uses multiple strategies to find article content
 */
function extractArticleText(html: string): string {
  // Remove scripts, styles, nav, footer, header, aside
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to find article container
  let articleHtml = ''
  
  // Strategy 1: Look for <article> tag
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    articleHtml = articleMatch[1]
  }
  
  // Strategy 2: Look for common article class names
  if (!articleHtml) {
    const contentPatterns = [
      /<div[^>]*class=["'][^"']*(?:article-content|article-body|post-content|entry-content|content-body|story-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class=["'][^"']*(?:article|post|entry|story|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ]
    
    for (const pattern of contentPatterns) {
      const match = cleaned.match(pattern)
      if (match && match[1].length > 200) {
        articleHtml = match[1]
        break
      }
    }
  }
  
  // Strategy 3: Look for paragraphs in main content
  if (!articleHtml) {
    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      articleHtml = mainMatch[1]
    }
  }

  // If still no content, use the whole body
  if (!articleHtml) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      articleHtml = bodyMatch[1]
    } else {
      articleHtml = cleaned
    }
  }

  // Extract text from paragraphs
  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let pMatch
  
  while ((pMatch = pRegex.exec(articleHtml)) !== null) {
    const text = cleanText(pMatch[1])
    // Only include paragraphs with meaningful content
    if (text.length > 50 && !isBoilerplate(text)) {
      paragraphs.push(text)
    }
  }

  // If not enough paragraphs found, try to extract all text
  if (paragraphs.length < 3) {
    const allText = cleanText(articleHtml)
    if (allText.length > 200) {
      return allText
    }
  }

  return paragraphs.join('\n\n')
}

/**
 * Clean HTML text - remove tags and decode entities
 */
function cleanText(html: string): string {
  return html
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if text is likely boilerplate (cookie notices, etc)
 */
function isBoilerplate(text: string): boolean {
  const boilerplateKeywords = [
    'cookie',
    'privacy policy',
    'politique de confidentialité',
    'newsletter',
    'subscribe',
    's\'abonner',
    'sign up',
    'terms of service',
    'conditions d\'utilisation',
    'partager sur',
    'share on',
    'copyright',
    'tous droits réservés',
    'all rights reserved',
  ]
  
  const lowerText = text.toLowerCase()
  return boilerplateKeywords.some(keyword => lowerText.includes(keyword))
}

