import OpenAI from 'openai'
import { ScrapedArticle, PodcastScript, ArticleWithScore, ScriptChunk } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type AnalysisType = 'general' | 'fun' | 'faits-divers' | 'politique' | 'sport'

/**
 * Construit le prompt selon le type d'analyse
 */
function buildPromptForAnalysisType(articles: ScrapedArticle[], analysisType: AnalysisType): string {
  const articlesList = articles.map((article, idx) => `
${idx + 1}. ${article.title}
Résumé : ${article.summary}
Catégorie : ${article.category || 'Non catégorisée'}
`).join('\n')

  const baseFormat = `
Articles à analyser :
${articlesList}

Réponds UNIQUEMENT avec un JSON valide au format suivant :
{
  "articles": [
    {
      "index": 0,
      "score": 85,
      "reason": "Raison courte du score"
    }
  ]
}`

  if (analysisType === 'fun') {
    return `Tu es un éditorialiste spécialisé dans le divertissement et les histoires insolites pour un podcast fun et léger.

Analyse ces ${articles.length} articles du journal Sud-Ouest et attribue à chacun un score d'intérêt de 0 à 100 pour un podcast orienté FUN et DIVERTISSEMENT.

⚠️ RÈGLE STRICTE : 
- Si l'article parle de politique, économie, sport sérieux, fait divers grave, accident, décès, conflit → score MAX 20/100
- Si l'article n'est PAS amusant, insolite, léger ou positif → score MAX 30/100

✅ Ce qui DOIT avoir un score élevé (60-100) :
- Histoires drôles, insolites, surprenantes
- Événements feel-good et positifs
- Anecdotes locales amusantes
- Initiatives originales et créatives
- Records insolites, faits étonnants
- Histoires d'animaux mignons

Critères de notation :
- Caractère insolite ou amusant (35 points)
- Potentiel de faire sourire l'auditeur (30 points)
- Originalité de l'histoire (20 points)
- Aspect léger et positif (10 points)
- Potentiel narratif audio engageant (5 points)

Sois TRÈS sélectif. La majorité des articles doivent avoir un score < 40.
${baseFormat}`
  }

  if (analysisType === 'faits-divers') {
    return `Tu es un éditorialiste spécialisé dans les faits divers pour un podcast captivant et immersif.

Analyse ces ${articles.length} articles du journal Sud-Ouest et attribue à chacun un score d'intérêt de 0 à 100 pour un podcast orienté FAITS DIVERS.

⚠️ RÈGLE STRICTE :
- Si l'article parle de politique, sport, culture, économie, urbanisme → score MAX 20/100
- Si l'article n'est PAS un fait divers (crime, accident, affaire judiciaire, fait insolite local) → score MAX 25/100

✅ Ce qui DOIT avoir un score élevé (60-100) :
- Accidents et incidents
- Affaires criminelles et judiciaires
- Cambriolages, vols, agressions
- Disparitions, recherches
- Incendies, catastrophes naturelles
- Faits insolites de la vie quotidienne
- Interventions pompiers/police
- Sauvetages

Critères de notation :
- Caractère sensationnel ou dramatique (30 points)
- Intrigue et suspense de l'histoire (25 points)
- Impact émotionnel (20 points)
- Proximité géographique (15 points)
- Potentiel narratif captivant (10 points)

Sois TRÈS strict. Seuls les vrais faits divers méritent un score > 50.
${baseFormat}`
  }

  if (analysisType === 'politique') {
    return `Tu es un éditorialiste politique chevronné pour un podcast d'analyse politique approfondie.

Analyse ces ${articles.length} articles du journal Sud-Ouest et attribue à chacun un score d'intérêt de 0 à 100 pour un podcast orienté POLITIQUE.

⚠️ RÈGLE STRICTE :
- Si l'article parle de sport, culture, fait divers, météo, gastronomie → score MAX 15/100
- Si l'article ne concerne PAS la politique (élus, institutions, décisions publiques, débats de société) → score MAX 25/100

✅ Ce qui DOIT avoir un score élevé (60-100) :
- Décisions des élus (maire, président région, députés)
- Élections et campagnes électorales
- Politiques publiques (transport, logement, éducation, santé)
- Débats au conseil municipal/régional
- Budgets et finances publiques
- Manifestations et mouvements sociaux
- Réformes et législation
- Enjeux démocratiques

Critères de notation :
- Importance politique de l'information (35 points)
- Impact sur les politiques publiques (25 points)
- Enjeux électoraux ou démocratiques (20 points)
- Dimension locale/régionale du débat (10 points)
- Potentiel d'analyse approfondie (10 points)

Sois TRÈS strict. Un article qui mentionne juste un élu n'est pas forcément politique.
${baseFormat}`
  }

  if (analysisType === 'sport') {
    return `Tu es un éditorialiste sportif passionné pour un podcast dynamique sur l'actualité sportive.

Analyse ces ${articles.length} articles du journal Sud-Ouest et attribue à chacun un score d'intérêt de 0 à 100 pour un podcast orienté SPORT.

⚠️ RÈGLE STRICTE ET CRITIQUE :
- Si l'article ne parle PAS de compétition sportive, match, performance athlétique → score MAX 20/100
- Si l'article parle de politique, culture, économie, urbanisme, fait divers → score 0-15/100
- Si l'article mentionne juste un stade/club sans parler de sport → score MAX 25/100
- Un article sur la construction d'un stade n'est PAS du sport → score MAX 20/100
- Un article sur les finances d'un club n'est PAS du sport → score MAX 30/100

✅ Ce qui EST du sport et DOIT avoir un score élevé (60-100) :
- Matchs et résultats (foot, rugby, basket, handball, etc.)
- Performances et records d'athlètes
- Championnats et compétitions
- Transferts de joueurs
- Blessures et retours de joueurs
- Entraînements et préparation
- Déclarations d'entraîneurs/joueurs sur le jeu
- Exploits sportifs individuels ou collectifs

❌ Ce qui N'EST PAS du sport (score < 25) :
- Construction/rénovation d'infrastructures sportives
- Aspects financiers ou administratifs des clubs
- Événements culturels dans un stade
- Politique sportive ou élections fédérales
- Simple mention d'un club/stade sans action sportive

Critères de notation (UNIQUEMENT pour les vrais articles sportifs) :
- Importance sportive de l'événement (30 points)
- Passion et émotion générées (25 points)
- Notoriété des équipes/athlètes (20 points)
- Impact local/régional (15 points)
- Potentiel narratif dynamique (10 points)

Sois EXTRÊMEMENT strict. Si tu hésites, donne un score < 30. Seuls les articles 100% sportifs méritent > 60.
${baseFormat}`
  }

  // Type 'general' par défaut
  return `Tu es un éditorialiste professionnel pour un podcast d'actualités généralistes équilibré.

Analyse ces ${articles.length} articles du journal Sud-Ouest et attribue à chacun un score d'intérêt de 0 à 100 pour un podcast quotidien varié.

⚠️ RÈGLES :
- Privilégie la DIVERSITÉ des sujets (pas 3 articles sur le même thème)
- Évite les articles trop techniques ou spécialisés → score MAX 40/100
- Évite les brèves sans substance → score MAX 30/100
- Recherche un équilibre : politique, société, culture, économie locale, faits marquants

✅ Ce qui DOIT avoir un score élevé (60-100) :
- Actualités importantes avec impact local
- Décisions qui affectent le quotidien des habitants
- Événements culturels majeurs
- Faits marquants et insolites
- Initiatives locales innovantes
- Changements concrets dans la région

❌ Scores bas (< 35) :
- Brèves sans détails
- Sujets trop nichés
- Doublons d'information
- Articles purement administratifs

Critères de notation :
- Importance de l'actualité (30 points)
- Intérêt pour un public général (25 points)
- Originalité/exclusivité (20 points)
- Impact local ou régional (15 points)
- Potentiel narratif audio (10 points)

Vise un podcast varié et intéressant pour tous. Sois sélectif mais équilibré.
${baseFormat}`
}

/**
 * Analyse les articles et leur attribue un score d'intérêt
 * Sélectionne automatiquement les 5 articles les plus intéressants
 */
export async function analyzeAndSelectArticles(
  articles: ScrapedArticle[],
  analysisType: AnalysisType = 'general'
): Promise<ArticleWithScore[]> {
  console.log(`Analyzing ${articles.length} articles with AI (type: ${analysisType})...`)
  
  // Vérifier si la clé OpenAI est configurée
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-proj-VOTRE_CLE_ICI') {
    console.warn('⚠️  OpenAI API key not configured, using fallback scoring')
    return articles.map((article, idx) => ({
      ...article,
      id: idx,
      score: 70 - (idx * 2), // Score décroissant basé sur l'ordre RSS
      selected: idx < 5,
    }))
  }
  
  const prompt = buildPromptForAnalysisType(articles, analysisType)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui répond UNIQUEMENT en JSON valide, sans texte additionnel.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    // Créer le tableau avec scores
    const articlesWithScores: ArticleWithScore[] = articles.map((article, idx) => {
      const analysis = result.articles?.find((a: { index: number }) => a.index === idx)
      return {
        ...article,
        id: idx,
        score: analysis?.score || 0,
        selected: false,
      }
    })

    // Trier par score et sélectionner les 5 meilleurs
    articlesWithScores.sort((a, b) => b.score - a.score)
    articlesWithScores.slice(0, 5).forEach(article => {
      article.selected = true
    })

    return articlesWithScores
  } catch (error) {
    console.error('❌ Error analyzing articles with OpenAI:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    
    // Fallback : retourner tous les articles avec score décroissant
    console.log('Using fallback scoring method...')
    return articles.map((article, idx) => ({
      ...article,
      id: idx,
      score: 70 - (idx * 2), // Score décroissant basé sur l'ordre RSS
      selected: idx < 5,
    }))
  }
}

/**
 * Génère un script de podcast à partir des articles sélectionnés
 */
export async function generatePodcastScript(
  articles: ScrapedArticle[],
  targetDuration: number = 240 // 4 minutes par défaut
): Promise<PodcastScript> {
  console.log(`Generating podcast script for ${articles.length} articles...`)
  
  // Vérifier si la clé OpenAI est configurée
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-proj-VOTRE_CLE_ICI') {
    console.warn('⚠️  OpenAI API key not configured, using fallback script generation')
    return generateFallbackScript(articles, targetDuration)
  }
  
  const prompt = `Tu es un scénariste de podcast d'actualités pour Sud-Ouest.

Crée un script audio de ${Math.floor(targetDuration / 60)} minutes environ (${targetDuration} secondes) basé sur ces ${articles.length} articles.

Le script doit :
- Commencer par une introduction accrocheuse
- Présenter chaque article de manière claire et engageante
- Faire des transitions naturelles entre les articles
- Se terminer par une conclusion
- Être écrit pour être lu à voix haute (style conversationnel)
- Utiliser un ton professionnel mais accessible

⚠️ CONTRAINTE IMPORTANTE : 
- Utilise des phrases COURTES (15-25 mots maximum par phrase)
- Chaque phrase doit faire MOINS DE 250 caractères
- Évite les phrases complexes avec plusieurs propositions
- Privilégie les phrases simples et directes
- Utilise des points fréquents pour séparer les idées
- Ceci est crucial pour la synthèse vocale (TTS)

Articles à inclure :
${articles.map((article, idx) => `
${idx + 1}. ${article.title}
${article.summary}
`).join('\n')}

Date du podcast : ${new Date().toLocaleDateString('fr-FR', { 
  weekday: 'long', 
  day: 'numeric', 
  month: 'long', 
  year: 'numeric' 
})}

Réponds avec un JSON au format suivant :
{
  "introduction": "Texte de l'introduction...",
  "articles": [
    {
      "title": "Titre de l'article",
      "content": "Script pour cet article..."
    }
  ],
  "conclusion": "Texte de conclusion..."
}

RAPPEL : Phrases courtes (< 250 caractères chacune) !`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Tu es un scénariste de podcast professionnel. Réponds en JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    const baseScript = {
      introduction: result.introduction || '',
      articles: (result.articles || []).map((article: { title: string, content: string }, idx: number) => ({
        articleId: idx,
        title: article.title,
        content: article.content,
      })),
      conclusion: result.conclusion || '',
      estimatedDuration: targetDuration,
    }
    
    // Générer les chunks de 300 caractères
    const chunks = scriptToChunks(baseScript)
    
    return {
      ...baseScript,
      chunks,
    }
  } catch (error) {
    console.error('❌ Error generating script with OpenAI:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    
    // Fallback : générer un script basique
    console.log('Using fallback script generation...')
    return generateFallbackScript(articles, targetDuration)
  }
}

/**
 * Découpe un texte en chunks de 300 caractères max pour le TTS
 * GARANTIT que AUCUN chunk ne dépasse 300 caractères
 */
function splitIntoTTSChunks(text: string): string[] {
  const maxLength = 300
  
  if (!text || text.trim().length === 0) {
    return []
  }
  
  if (text.length <= maxLength) {
    return [text]
  }
  
  const chunks: string[] = []
  
  // Étape 1: Découper par phrases (. ! ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    
    // Si la phrase seule dépasse 300 caractères, la découper par mots
    if (trimmedSentence.length > maxLength) {
      console.warn(`⚠️ Sentence exceeds ${maxLength} chars (${trimmedSentence.length}), splitting by words...`)
      
      // Sauvegarder le chunk en cours
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      
      // Découper la phrase trop longue par mots
      const words = trimmedSentence.split(/\s+/)
        let wordChunk = ''
        
        for (const word of words) {
        const testChunk = wordChunk ? wordChunk + ' ' + word : word
        
        if (testChunk.length > maxLength) {
          // Si un seul mot dépasse 300 caractères, le tronquer (cas extrême)
          if (word.length > maxLength) {
            console.error(`❌ Single word exceeds ${maxLength} chars: "${word.substring(0, 50)}..."`)
            if (wordChunk.trim().length > 0) {
              chunks.push(wordChunk.trim())
            }
            // Tronquer le mot à 295 caractères + "..."
            chunks.push(word.substring(0, 297) + '...')
            wordChunk = ''
          } else {
            if (wordChunk.trim().length > 0) {
              chunks.push(wordChunk.trim())
            }
            wordChunk = word
          }
        } else {
          wordChunk = testChunk
        }
      }
      
      if (wordChunk.trim().length > 0) {
        currentChunk = wordChunk
      }
    } else {
      // Phrase normale, tenter de l'ajouter au chunk en cours
      const testChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence
      
      if (testChunk.length > maxLength) {
        // Sauvegarder le chunk en cours et commencer un nouveau
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = trimmedSentence
    } else {
      currentChunk = testChunk
      }
    }
  }
  
  // Ajouter le dernier chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  // VALIDATION FINALE : vérifier qu'aucun chunk ne dépasse 300 caractères
  const validatedChunks = chunks.map((chunk, idx) => {
    if (chunk.length > maxLength) {
      console.error(`❌ Chunk ${idx} still exceeds ${maxLength} chars (${chunk.length}), force truncating...`)
      return chunk.substring(0, 297) + '...'
    }
    return chunk
  })
  
  // Logs pour debugging
  const maxChunkLength = Math.max(...validatedChunks.map(c => c.length))
  console.log(`✅ Generated ${validatedChunks.length} chunks, max length: ${maxChunkLength} chars`)
  
  return validatedChunks.filter(chunk => chunk.trim().length > 0)
}

/**
 * Merge plusieurs chunks en un seul, en respectant STRICTEMENT la limite de 300 chars
 */
function mergeChunksToLimit(textChunks: string[], maxChunks: number): string[] {
  const maxLength = 300
  
  if (textChunks.length <= maxChunks) {
    // Vérifier quand même que tous les chunks respectent la limite
    return textChunks.map(chunk => {
      if (chunk.length > maxLength) {
        console.warn(`⚠️ Chunk exceeds ${maxLength} chars, truncating...`)
        return chunk.substring(0, 297) + '...'
      }
      return chunk
    })
  }
  
  const result: string[] = []
  let currentChunk = ''
  
  for (const chunk of textChunks) {
    const testChunk = currentChunk ? currentChunk + ' ' + chunk : chunk
    
    // Si le test dépasse 300 caractères, sauvegarder et recommencer
    if (testChunk.length > maxLength) {
      if (currentChunk.length > 0) {
        result.push(currentChunk)
        currentChunk = chunk
      } else {
        // Chunk seul trop long, le tronquer
        result.push(chunk.substring(0, 297) + '...')
        currentChunk = ''
      }
      
      // Si on a atteint le nombre max de chunks, forcer la fusion
      if (result.length >= maxChunks - 1) {
        break
      }
    } else {
      currentChunk = testChunk
    }
  }
  
  // Ajouter le dernier chunk
  if (currentChunk.length > 0) {
    if (currentChunk.length > maxLength) {
      result.push(currentChunk.substring(0, 297) + '...')
    } else {
      result.push(currentChunk)
    }
  }
  
  return result
}

/**
 * Convertit un script en chunks de 300 caractères max
 * Limite: 1 chunk pour intro, max 2 par article, 1 pour conclusion
 * GARANTIT que tous les chunks respectent la limite de 300 caractères
 */
function scriptToChunks(script: PodcastScript): ScriptChunk[] {
  const maxLength = 300
  const chunks: ScriptChunk[] = []
  let chunkIndex = 0
  
  console.log('📝 Converting script to TTS chunks...')
  
  // Introduction - MAX 1 chunk
  const introChunks = splitIntoTTSChunks(script.introduction)
  const mergedIntro = mergeChunksToLimit(introChunks, 1)
  mergedIntro.forEach(text => {
    chunks.push({
      text,
      index: chunkIndex++,
      section: 'introduction',
    })
  })
  console.log(`✅ Introduction: ${mergedIntro.length} chunk(s)`)
  
  // Articles - MAX 2 chunks per article
  script.articles.forEach((article, idx) => {
    const articleChunks = splitIntoTTSChunks(article.content)
    const mergedArticle = mergeChunksToLimit(articleChunks, 2)
    mergedArticle.forEach(text => {
      chunks.push({
        text,
        index: chunkIndex++,
        section: 'article',
        articleTitle: article.title,
      })
    })
    console.log(`✅ Article ${idx + 1} "${article.title}": ${mergedArticle.length} chunk(s)`)
  })
  
  // Conclusion - MAX 1 chunk
  const conclusionChunks = splitIntoTTSChunks(script.conclusion)
  const mergedConclusion = mergeChunksToLimit(conclusionChunks, 1)
  mergedConclusion.forEach(text => {
    chunks.push({
      text,
      index: chunkIndex++,
      section: 'conclusion',
    })
  })
  console.log(`✅ Conclusion: ${mergedConclusion.length} chunk(s)`)
  
  // VALIDATION FINALE : vérifier que TOUS les chunks respectent la limite
  let hasErrors = false
  chunks.forEach((chunk, idx) => {
    if (chunk.text.length > maxLength) {
      console.error(`❌ CRITICAL: Chunk ${idx} (${chunk.section}) exceeds ${maxLength} chars: ${chunk.text.length}`)
      console.error(`   Text preview: "${chunk.text.substring(0, 100)}..."`)
      hasErrors = true
      // Correction forcée
      chunk.text = chunk.text.substring(0, 297) + '...'
    }
  })
  
  if (hasErrors) {
    console.error('⚠️ Some chunks were forcefully truncated to respect 300 char limit')
  }
  
  const stats = {
    total: chunks.length,
    maxLength: Math.max(...chunks.map(c => c.text.length)),
    avgLength: Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length),
  }
  
  console.log(`📊 Final chunks: ${stats.total} total, max ${stats.maxLength} chars, avg ${stats.avgLength} chars`)
  
  return chunks
}

/**
 * Génère un script de podcast basique en fallback (sans IA)
 */
function generateFallbackScript(
  articles: ScrapedArticle[],
  targetDuration: number
): PodcastScript {
  const date = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })
  
  const introduction = `Bonjour et bienvenue dans votre podcast d'actualités Sud-Ouest du ${date}. Aujourd'hui, nous avons sélectionné ${articles.length} informations importantes de la région. Bonne écoute !`
  
  const scriptArticles = articles.map((article, idx) => ({
    articleId: idx,
    title: article.title,
    content: `${article.title}. ${article.summary}`,
  }))
  
  const conclusion = `C'était votre podcast Sud-Ouest du ${date}. Merci de votre écoute et à très bientôt pour de nouvelles actualités de la région.`
  
  const baseScript = {
    introduction,
    articles: scriptArticles,
    conclusion,
    estimatedDuration: targetDuration,
  }
  
  // Générer les chunks
  const chunks = scriptToChunks(baseScript)
  
  return {
    ...baseScript,
    chunks,
  }
}

/**
 * Organise les articles par thèmes/catégories
 */
export async function categorizeArticles(
  articles: ScrapedArticle[]
): Promise<Map<string, ScrapedArticle[]>> {
  const categories = new Map<string, ScrapedArticle[]>()

  // Grouper par catégorie existante d'abord
  articles.forEach(article => {
    const category = article.category || 'Non catégorisé'
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)?.push(article)
  })

  return categories
}

