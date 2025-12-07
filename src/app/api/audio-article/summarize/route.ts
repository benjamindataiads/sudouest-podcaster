import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

// Approximate words per second for speech (varies by language)
const WORDS_PER_SECOND = 2.5

// Lazy-load OpenAI client to avoid build-time errors
let openaiClient: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

/**
 * POST /api/audio-article/summarize
 * Summarize an article using OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { text, duration } = body

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
    }

    const durationSeconds = parseInt(duration) || 60
    const targetWordCount = Math.round(durationSeconds * WORDS_PER_SECOND)

    console.log(`📝 Summarizing article for ~${durationSeconds}s (~${targetWordCount} words)`)

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es un journaliste expert en rédaction de résumés concis et engageants. 
Tu dois créer un résumé qui sera lu à haute voix, donc:
- Utilise des phrases courtes et claires
- Évite les acronymes ou explique-les
- Le résumé doit durer environ ${durationSeconds} secondes à la lecture (environ ${targetWordCount} mots)
- Commence directement par le contenu, pas de "Voici un résumé..."
- Garde un ton informatif mais accessible`,
        },
        {
          role: 'user',
          content: `Résume cet article en environ ${targetWordCount} mots pour une lecture de ${durationSeconds} secondes:

${text}

Réponds avec un JSON contenant:
- "title": un titre court et accrocheur (max 60 caractères)
- "summary": le résumé optimisé pour la lecture audio`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    console.log(`✅ Summary generated: ${result.summary?.length || 0} chars, title: ${result.title}`)

    return NextResponse.json({
      title: result.title || 'Article',
      summary: result.summary || '',
      wordCount: result.summary?.split(/\s+/).length || 0,
    })
  } catch (error) {
    console.error('Error summarizing:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du résumé' },
      { status: 500 }
    )
  }
}

